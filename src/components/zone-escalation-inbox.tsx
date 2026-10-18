"use client";
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {fetchAllRows} from '@/lib/fetch-all-rows';
import {useDashboardRefresh} from '@/lib/use-dashboard-refresh';
import {ZoneTaskHistory,statusLabels,type ZoneTask} from '@/components/zone-operations';
import '@/app/zone-operations.css';

export default function ZoneEscalationInbox(){
 const tick=useDashboardRefresh();const [rows,setRows]=useState<ZoneTask[]>([]),[zones,setZones]=useState<Record<number,string>>({}),[showCompleted,setShowCompleted]=useState(false),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;void(async()=>{try{const db=createClient(),[r,z]=await Promise.all([fetchAllRows((a,b)=>db.from('zone_tasks').select('*').eq('kind','escalation').order('updated_at',{ascending:false}).order('id').range(a,b)),db.from('zones').select('id,name')]);if(r.error||z.error)throw Error();if(active){setRows(r.data as ZoneTask[]);setZones(Object.fromEntries(z.data.map(z=>[z.id,z.name])));setError('');}}catch{if(active)setError('Zone escalations could not be loaded. Please refresh.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[tick,refresh]);
 const shown=rows.filter(r=>showCompleted||r.status!=='completed');
 return <section className="zone-ops-panel" id="zone-escalations"><div className="zone-ops-heading"><div><p className="zone-eyebrow">ZONE LEADER SUPPORT</p><h2>Escalations to the pastor</h2><p>{rows.filter(r=>r.status!=='completed').length} open · Responses appear in the zone leader’s dashboard.</p></div><button onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'Show open':'Include completed'}</button></div>{error&&<p role="alert" className="zone-ops-error">{error}</p>}{loading?<p role="status">Loading escalations…</p>:!shown.length?<p>No escalations in this view.</p>:shown.map(r=><article key={r.id} className="zone-task-card"><h3>{r.title}</h3><p className="zone-ops-meta">{zones[r.zone_id]??`Zone ${r.zone_id}`} · {statusLabels[r.status]} · {r.assignee}</p><p className="zone-task-details">{r.details}</p><Reply key={r.id+':'+r.version} task={r} onSaved={()=>setRefresh(v=>v+1)}/><ZoneTaskHistory id={r.id}/></article>)}</section>;
}
function Reply({task,onSaved}:{task:ZoneTask;onSaved:()=>void}){
 const [response,setResponse]=useState(task.pastor_response),[status,setStatus]=useState(task.status),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await createClient().rpc('respond_zone_escalation',{p_id:task.id,p_version:task.version,p_status:status,p_response:response.trim()});if(r.error){setError(r.error.message.includes('TASK_CHANGED')?'This item changed. Refresh and review the latest details.':'The response could not be saved. Please try again.');return;}onSaved();}catch{setError('The response could not be saved. Check your connection.');}finally{setBusy(false);}}
 return <details><summary>Respond / update status</summary><form className="zone-task-form" onSubmit={save}><label>Response to the zone leader<textarea required maxLength={2000} rows={3} value={response} onChange={e=>setResponse(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as ZoneTask['status'])}>{Object.entries(statusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>{error&&<p role="alert" className="zone-ops-error">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save response'}</button></form></details>;
}
