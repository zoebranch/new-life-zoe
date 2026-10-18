'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import './outreach-team.css';
type Status='new'|'no_answer'|'following_up'|'invited'|'attended'|'completed'|'do_not_contact';
const labels:Record<Status,string>={new:'Not contacted',no_answer:'Called · no answer',following_up:'Reached · following up',invited:'Invited to a cell',attended:'Attended',completed:'Completed',do_not_contact:'Do not contact'};
type Contact={id:string;name:string;phone:string;area:string;status:Status;nextDue:string|null;version:number;history:{id:string;actor:string;message:string;at:string}[]};
type Queue={team:{id:string;name:string;expiresAt:string}[];contacts:Contact[]};
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lusaka'}).format(new Date());}
export default function OutreachTeamDashboard(){
 const [queue,setQueue]=useState<Queue|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState<string|null>(null),[status,setStatus]=useState<Status>('following_up'),[notes,setNotes]=useState(''),[due,setDue]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[showCompleted,setShowCompleted]=useState(false);const preview=false;
 const token=useRef(''),db=useRef<SupabaseClient|null>(null),operation=useRef(false),epoch=useRef(0),entryId=useRef('');
 const contact=queue?.contacts.find(c=>c.id===selected);
 useEffect(()=>{
  let active=true;
  if(!token.current){token.current=new URLSearchParams(location.hash.slice(1)).get('token')??'';if(location.hash)history.replaceState(null,'',location.pathname);}
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url&&key&&!db.current)db.current=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  async function load(){
   if(operation.current||document.hidden)return;const current=++epoch.current;
   if(!/^[0-9a-f]{64}$/.test(token.current)||!db.current){if(active){setQueue(null);setError('This link is unavailable. Ask your cell leader for a new invitation.');setLoading(false);}return;}
   const result=await db.current.rpc('outreach_guest',{p_token:token.current});
   if(!active||current!==epoch.current)return;
   if(result.error){setQueue(null);setSelected(null);setError(result.error.message.includes('OUTREACH_LINK_UNAVAILABLE')?'Your link has expired or been revoked. Ask your cell leader for a new invitation.':'Your assignments could not be verified. Check your connection and refresh.');}
   else{setQueue(result.data as Queue);setError('');}setLoading(false);
  }
  void load();const timer=setInterval(()=>void load(),15000);const foreground=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',foreground);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',foreground);};
 },[revision]);
 function open(c:Contact){setSelected(c.id);setStatus('following_up');setNotes('');setDue(today());setError('');setNotice('');entryId.current=crypto.randomUUID();}
 async function save(form:HTMLFormElement){
  const values=new FormData(form);const status=String(values.get('status')??'following_up') as Status;const notes=String(values.get('notes')??'');
  const submittedDate=values.get('nextDue');const nextDate=typeof submittedDate==='string'?submittedDate:due;
  if(operation.current||!contact)return;
  if(notes.length>2000){setError('Keep notes within 2,000 characters.');return;}
  const closed=status==='completed'||status==='do_not_contact';
  if(!closed&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)||nextDate<today())){setError('Choose the next follow-up date, today or later.');return;}
  operation.current=true;epoch.current++;setBusy(true);setError('');setNotice('');
  try{
   if(preview){setQueue(q=>q?{...q,contacts:status==='do_not_contact'?q.contacts.filter(c=>c.id!==contact.id):q.contacts.map(c=>c.id===contact.id?{...c,status,nextDue:closed?null:nextDate,version:c.version+1,history:[{id:entryId.current,actor:'Ruth (sample)',message:labels[status]+(notes.trim()?' — '+notes.trim():''),at:new Date().toISOString()},...c.history]}:c)}:null);}
   else{
    if(!db.current)throw Error('The connection is unavailable.');
    const result=await db.current.rpc('outreach_guest',{p_token:token.current,p_payload:{contactId:contact.id,version:contact.version,entryId:entryId.current,status,notes,nextDue:closed?null:nextDate}});
    if(result.error){if(result.error.message.includes('OUTREACH_LINK_UNAVAILABLE')){setQueue(null);throw Error('Your link has expired or been revoked. Ask your cell leader for a new invitation.');}if(/OUTREACH_(CHANGED|ASSIGNMENT_CHANGED)/.test(result.error.message)){setSelected(null);setRevision(v=>v+1);throw Error('This contact changed or was reassigned. Refresh your queue before calling.');}throw Error('The update could not be confirmed. Refresh before retrying.');}
    setQueue(result.data as Queue);
   }
   setSelected(null);setNotice(preview?'Sample outcome recorded.':'Outcome saved. Your cell leader’s dashboard will update automatically.');
  }catch(e){setError(e instanceof Error?e.message:'Your update could not be saved.');}finally{operation.current=false;setBusy(false);}
 }
 const openContacts=queue?.contacts.filter(c=>c.status!=='completed')??[],shown=queue?.contacts.filter(c=>showCompleted||c.status!=='completed')??[];
 return <main className="outreach-team"><header><Link href="/">ZOE BRANCH</Link><span>Evangelism follow-up</span></header><section className="outreach-team-intro"><p className="outreach-eyebrow">{preview?'INTERACTIVE SAMPLE DASHBOARD':'YOUR PRIVATE TEAM DASHBOARD'}</p><h1>{queue?'Hello, '+queue.team[0]?.name+'.':'Your follow-up assignments.'}</h1><p>One conversation at a time. These are the people entrusted to your care.</p>{preview&&<p className="outreach-preview">Sample contacts only. No real calls are placed or database records changed.</p>}</section>
 {loading?<p role="status">Loading your assignments…</p>:<>
 {error&&<p role="alert" className="outreach-error">{error}</p>}{notice&&<p role="status" className="outreach-notice">{notice}</p>}
 {queue?<><section className="outreach-summary"><div><strong>{openContacts.length}</strong><span>Open follow-ups</span></div><div><strong>{openContacts.filter(c=>c.nextDue&&c.nextDue<=today()).length}</strong><span>Due or overdue</span></div></section><div className="outreach-actions"><button disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh assignments</button><button onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'Hide completed':'Include completed'}</button></div><p className="outreach-help">Only your assigned contacts appear here. Opening the dialler does not record a call. After calling, record the outcome below.</p>
 {shown.length===0?<section className="outreach-contact"><h2>No open assignments.</h2><p>Your cell leader can assign more contacts to you.</p></section>:shown.map(c=><article className="outreach-contact" key={c.id}><div className="outreach-card-top"><h2>{c.name}</h2><span>{labels[c.status]}</span></div><p>{c.area}</p><p className="outreach-phone">+{c.phone}</p>{c.nextDue&&<p className="outreach-due">{c.nextDue<today()?'Overdue':c.nextDue===today()?'Due today':'Next follow-up'} · {c.nextDue}</p>}<div className="outreach-actions">{c.status!=='completed'&&(preview?<button onClick={()=>setNotice('Preview only. No real call is placed. Record the sample outcome after this step.')}>Simulate opening dialler</button>:<a className="outreach-primary" href={'tel:+'+c.phone}>Call contact</a>)}<button className="outreach-primary" disabled={busy} onClick={()=>open(c)}>Record outcome</button></div><details><summary>Follow-up history ({c.history.length})</summary>{c.history.length?c.history.map(h=><div key={h.id} className="outreach-history"><b>{h.actor}</b><p>{h.message}</p><small>{new Date(h.at).toLocaleString('en-GB',{timeZone:'Africa/Lusaka'})}</small></div>):<p>No calls recorded yet.</p>}</details></article>)}<footer>Private link · {preview?'Sample expiration':'Expires '+new Date(queue.team[0]?.expiresAt).toLocaleString('en-GB',{timeZone:'Africa/Lusaka'})}. Keep this link private. Keep the original invitation to reopen your dashboard. Your cell leader can revoke access at any time.</footer></>:<><p>No contact information is available through this link.</p><button onClick={()=>setRevision(v=>v+1)}>Try again</button></>}
 </>}
 {contact&&<div className="outreach-modal"><section role="dialog" aria-modal="true" aria-labelledby="outcome-title"><h2 id="outcome-title">Follow up with {contact.name}</h2><p>Record what happened and when to follow up again.</p><form onSubmit={e=>{e.preventDefault();void save(e.currentTarget);}}><label>Outcome<select name="status" value={status} onChange={e=>setStatus(e.target.value as Status)} disabled={busy}>{Object.entries(labels).filter(([k])=>k!=='new').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Notes<textarea name="notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000} rows={4} disabled={busy}/></label>{status!=='completed'&&status!=='do_not_contact'&&<label>Next follow-up date<input name="nextDue" type="date" min={today()} value={due} onChange={e=>setDue(e.target.value)} required disabled={busy}/></label>}{error&&<p role="alert" className="outreach-error">{error}</p>}<div className="outreach-actions"><button className="outreach-primary" disabled={busy}>{busy?'Saving…':'Save outcome'}</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setError('');}}>Cancel</button></div></form></section></div>}
 </main>;
}

