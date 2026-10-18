import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table zones(id bigint primary key,is_active boolean);create table cells(id bigint primary key,zone_id bigint references zones(id),is_active boolean);create table profiles(user_id uuid primary key,role text,cell_id bigint,display_name text,is_suspended boolean);`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261017000100_outreach_followup.sql',import.meta.url),'utf8'));
const leader=randomUUID(),other=randomUUID(),secretary=randomUUID();
await db.query('insert into auth.users values ($1),($2),($3)',[leader,other,secretary]);
await db.exec('insert into zones values(1,true);insert into cells values(1,1,true),(2,1,true)');
await db.query("insert into profiles values ($1,'cell_leader',1,'Leader One',false),($2,'cell_leader',2,'Leader Two',false),($3,'secretary',null,'Secretary',false)",[leader,other,secretary]);
let assertions=0;
function ok(condition){assert.ok(condition);assertions++;}
async function call(role,uid,sql,args=[]){await db.query("select set_config('test.uid',$1,false)",[uid??'']);await db.exec('set role '+role);try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
async function manage(action,payload={},uid=leader){return (await call('authenticated',uid,'select public.outreach_manage($1,$2::jsonb) as data',[action,JSON.stringify(payload)])).rows[0].data;}
async function guest(token,payload=null){return (await call('anon',null,'select public.outreach_guest($1,$2::jsonb) as data',[token,payload?JSON.stringify(payload):null])).rows[0].data;}
async function denied(fn,pattern){await assert.rejects(fn,pattern);assertions++;}
await denied(()=>call('anon',null,'select public.outreach_dashboard()'),/permission denied/);
await denied(()=>call('authenticated',secretary,'select public.outreach_dashboard()'),/OUTREACH_ACCESS_DENIED/);
for(const table of ['outreach_contacts','outreach_team','outreach_history'])await denied(()=>call('authenticated',leader,'select * from '+table),/permission denied/);
let state=await manage('add_team',{name:'Caller A',phone:'0970000000'});const a=state.team[0].id;
state=await manage('add_team',{name:'Caller B'});const b=state.team.find(t=>t.name==='Caller B').id;
const ids=Array.from({length:4},()=>randomUUID());
for(let n=0;n<4;n++)state=await manage('add_contact',{id:ids[n],name:'Contact '+n,phone:'097012345'+n,area:'Test',metOn:'2026-10-17',consent:n!==3});
await denied(()=>manage('add_contact',{id:randomUUID(),name:'Duplicate',phone:'+260970123450',metOn:'2026-10-17',consent:true},other),/OUTREACH_PHONE_EXISTS/);
state=await manage('distribute');ok(state.contacts.find(c=>c.id===ids[3]).assignee===null);ok(state.contacts.filter(c=>c.assignee).length===3);
const first=state.contacts.find(c=>c.id===ids[0]),owner=first.assignee;const alternate=owner===a?b:a;
const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
state=await manage('issue_link',{teamId:owner,hash});
let queue=await guest(token);ok(queue.team.length===1&&queue.team[0].id===owner);ok(queue.contacts.every(c=>c.assignee===owner));ok(!JSON.stringify(queue).includes(hash));
await denied(()=>guest('a'.repeat(64)),/OUTREACH_LINK_UNAVAILABLE/);
const outsider=state.contacts.find(c=>c.assignee===alternate);
if(outsider)await denied(()=>guest(token,{contactId:outsider.id,version:outsider.version,entryId:randomUUID(),status:'no_answer',nextDue:'2099-01-01'}),/OUTREACH_ASSIGNMENT_CHANGED/);
const entryId=randomUUID(),payload={contactId:first.id,version:first.version,entryId,status:'no_answer',notes:'Try later',nextDue:'2099-01-01'};
queue=await guest(token,payload);const updated=queue.contacts.find(c=>c.id===first.id);ok(updated.status==='no_answer');ok(updated.history[0].actor===queue.team[0].name);
queue=await guest(token,payload);ok(queue.contacts.find(c=>c.id===first.id).history.filter(h=>h.id===entryId).length===1);
await denied(()=>guest(token,{...payload,entryId:randomUUID()}),/OUTREACH_CHANGED/);
state=await manage('assign',{contactId:first.id,version:updated.version,teamId:alternate});
queue=await guest(token);ok(!queue.contacts.some(c=>c.id===first.id));await denied(()=>guest(token,{...payload,version:updated.version,entryId:randomUUID()}),/OUTREACH_ASSIGNMENT_CHANGED/);
await denied(()=>manage('assign',{contactId:first.id,version:1,teamId:owner}),/OUTREACH_CHANGED/);
const replacement=randomBytes(32).toString('hex');await manage('issue_link',{teamId:owner,hash:createHash('sha256').update(replacement).digest('hex')});await denied(()=>guest(token),/OUTREACH_LINK_UNAVAILABLE/);await guest(replacement);await manage('issue_link',{teamId:owner,hash});
await manage('revoke_link',{teamId:owner});await denied(()=>guest(token),/OUTREACH_LINK_UNAVAILABLE/);
state=await manage('issue_link',{teamId:owner,hash});await db.query("update outreach_team set link_expires_at=now()-interval '1 second' where id=$1",[owner]);await denied(()=>guest(token),/OUTREACH_LINK_UNAVAILABLE/);
state=await manage('issue_link',{teamId:owner,hash});await db.query('update profiles set is_suspended=true where user_id=$1',[leader]);await denied(()=>guest(token),/OUTREACH_LINK_UNAVAILABLE/);await db.query('update profiles set is_suspended=false where user_id=$1',[leader]);
const removedToken=randomBytes(32).toString('hex');await manage('issue_link',{teamId:alternate,hash:createHash('sha256').update(removedToken).digest('hex')});await guest(removedToken);
state=await manage('remove_team',{teamId:alternate});await denied(()=>guest(removedToken),/OUTREACH_LINK_UNAVAILABLE/);ok(state.team.find(t=>t.id===alternate).active===false);ok(!state.contacts.some(c=>c.assignee===alternate&&c.status!=='completed'&&c.status!=='do_not_contact'));ok(state.contacts.find(c=>c.id===first.id).history.some(h=>h.id===entryId));
const own=state.contacts.find(c=>c.assignee===owner);if(own){state=await manage('outcome',{contactId:own.id,version:own.version,entryId:randomUUID(),status:'do_not_contact',notes:'Requested no more calls'});ok(state.contacts.find(c=>c.id===own.id).consent===false);ok(!(await guest(token)).contacts.some(c=>c.id===own.id));}
const otherState=(await call('authenticated',other,'select public.outreach_dashboard() as data')).rows[0].data;ok(otherState.contacts.length===0&&otherState.team.length===0);
console.log(JSON.stringify({result:'PASS',assertions,migration:'20261017000100',checks:['role access','direct table isolation','cross-cell duplicate prevention','one assignee','consent','team-specific queues','forged contact rejection','version checks','idempotent outcomes','reassignment','revocation','expiry','leader suspension','team removal','history preservation','do not contact','cross-cell isolation']}));
await db.close();
