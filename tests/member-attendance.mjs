import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table cells(id bigint primary key);create table profiles(user_id uuid primary key,cell_id bigint,role text,is_suspended boolean);create table members(id uuid primary key,cell_id bigint,name text,is_active boolean,joined_at timestamptz);create function private.outreach_cell() returns bigint language plpgsql security definer set search_path='' as $$declare result bigint;begin select cell_id into result from public.profiles where user_id=auth.uid() and role='cell_leader' and not is_suspended;if result is null then raise exception 'OUTREACH_ACCESS_DENIED';end if;return result;end;$$;`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261017000200_member_attendance.sql',import.meta.url),'utf8'));
const leader=randomUUID(),other=randomUUID(),secretary=randomUUID(),a=randomUUID(),b=randomUUID(),c=randomUUID();
await db.query('insert into auth.users values($1),($2),($3)',[leader,other,secretary]);await db.exec('insert into cells values(1),(2)');
await db.query("insert into profiles values($1,1,'cell_leader',false),($2,2,'cell_leader',false),($3,null,'secretary',false)",[leader,other,secretary]);
await db.query("insert into members values($1,1,'One',true,'2020-01-01'),($2,1,'Two',true,'2020-01-01'),($3,2,'Other cell',true,'2020-01-01')",[a,b,c]);
const date='2026-10-17';let checks=0;
async function call(uid,sql,args=[],role='authenticated'){await db.query("select set_config('test.uid',$1,false)",[uid??'']);await db.exec('set role '+role);try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
async function get(uid=leader,day=date){return (await call(uid,'select public.cell_attendance_get($1) as data',[day])).rows[0].data;}
async function save(entries,version=0,op=randomUUID(),uid=leader){return (await call(uid,'select public.cell_attendance_save($1,$2,$3,$4) as data',[date,version,JSON.stringify(entries),op])).rows[0].data;}
function ok(value){assert.ok(value);checks++;}async function denied(fn,pattern){await assert.rejects(fn,pattern);checks++;}
await denied(()=>call(null,'select public.cell_attendance_get($1)',[date],'anon'),/permission denied/);
await denied(()=>get(secretary),/ACCESS_DENIED/);
for(const table of ['cell_attendance_registers','cell_attendance_history'])await denied(()=>call(leader,'select * from '+table),/permission denied/);
let state=await get();ok(state.version===0&&state.roster.length===2&&state.roster.every(m=>m.status===null));ok((await get(other)).roster[0].id===c);
await denied(()=>get(leader,'2099-01-01'),/ATTENDANCE_DATE/);
const entries=[{id:a,status:'present'},{id:b,status:'absent'}],op=randomUUID();
await denied(()=>save([{id:a,status:'present'},{id:b,status:null}]),/ROSTER_CHANGED/);
await denied(()=>save([{id:a,status:'present'},{id:c,status:'absent'}]),/ROSTER_CHANGED/);
await denied(()=>save([{id:a,status:'present'},{id:a,status:'absent'}]),/ROSTER_CHANGED/);
state=await save(entries,0,op);ok(state.version===1&&state.roster.find(m=>m.id===a).status==='present');
ok((await save(entries,0,op)).version===1);
await denied(()=>save(entries,0),/ATTENDANCE_CHANGED/);
await db.query('update members set is_active=false where id=$1',[b]);state=await get();ok(state.roster.length===2); // historical roster stays intact
state=await save([{id:a,status:'absent'},{id:b,status:'present'}],1);ok(state.version===2);
ok((await db.query('select count(*)::int as count from cell_attendance_history')).rows[0].count===2);
ok((await get(other)).version===0);
await db.query('update profiles set is_suspended=true where user_id=$1',[leader]);await denied(()=>get(),/ACCESS_DENIED/);
console.log(JSON.stringify({result:'PASS',checks,coverage:['cell isolation','role restrictions','no direct table access','all members explicitly marked','forged and duplicate IDs rejected','save retries','stale versions','historical roster','correction history','suspension']}));await db.close();
