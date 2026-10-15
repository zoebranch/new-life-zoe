"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { useDashboardRefresh } from "@/lib/use-dashboard-refresh";
import { careKinds, localDateToday, type CareKind } from "@/lib/care-requests";

type Status = "pending" | "contacted" | "approved" | "rejected" | "closed";
type CareRequest = { id:string; kind:CareKind; name:string; phone:string; email:string; subject_name:string; announcement_requested:boolean; requested_date:string|null; preferred_time:string; guests:number; message:string; status:Status; staff_notes:string; confirmed_date:string|null; confirmed_time:string|null; created_at:string };
const labels:Record<Status,string> = { pending:"New", contacted:"Contacted", approved:"Approved", rejected:"Rejected", closed:"Completed / closed" };

function RequestReview({ item, onSaved }: { item:CareRequest; onSaved:()=>void }) {
  const [status,setStatus] = useState<Status>(item.status), [notes,setNotes] = useState(item.staff_notes || "");
  const [date,setDate] = useState(item.confirmed_date || item.requested_date || ""), [time,setTime] = useState(item.confirmed_time?.slice(0,5) || "");
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [notice,setNotice] = useState("");
  async function save(event:React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (status === "approved" && (!date || !time || date < localDateToday())) { setError("Choose today or a future date and a confirmed time."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const {error:saveError} = await createClient().rpc("review_care_request",{p_id:item.id,p_status:status,p_notes:notes.trim(),p_date:status==="approved"?date:null,p_time:status==="approved"?time:null});
      if (saveError) { setError(saveError.code === "23505" ? "Another appointment is already approved for this exact date and time. Choose another slot." : saveError.message.includes("future appointment") ? "Choose a date and time in the future, using Lusaka time." : "The review could not be saved. Refresh and try again."); return; }
      setNotice("Review saved. Contact the requester to communicate the decision; no email or SMS was sent."); onSaved();
    } catch { setError("The review could not be saved. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <article className="care-inbox-card">
    <div className="care-card-heading"><div><p className="care-category">{careKinds[item.kind]?.name || item.kind}</p><h3>{item.name || "Unnamed request"}</h3></div><span className={`care-status care-status-${item.status}`}>{labels[item.status]}</span></div>
    <dl className="care-facts">{item.phone && <div><dt>Phone</dt><dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd></div>}{item.email && <div><dt>Email</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a></dd></div>}{item.subject_name && <div><dt>Person / family</dt><dd>{item.subject_name}</dd></div>}{item.requested_date && <div><dt>Requested date</dt><dd>{item.requested_date}</dd></div>}{item.preferred_time && <div><dt>Preferred time</dt><dd>{item.preferred_time}</dd></div>}{item.kind === "visit" && <div><dt>Visitors</dt><dd>{item.guests}</dd></div>}{item.confirmed_date && <div><dt>Confirmed appointment</dt><dd>{item.confirmed_date} at {item.confirmed_time?.slice(0,5)}</dd></div>}</dl>
    <p className="care-message">{item.message || "No additional message."}</p>
    {item.announcement_requested && <p className="care-callout">An announcement discussion was requested. Confirm the details and permission before sharing anything publicly.</p>}
    <p className="care-received">Received {new Date(item.created_at).toLocaleString()}</p>
    <details><summary>Review &amp; follow up</summary><form onSubmit={save} className="care-review-form">
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value as Status)}>{(Object.keys(labels) as Status[]).filter(s=>item.kind==="appointment" || !["approved","rejected"].includes(s)).map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
      {item.kind === "appointment" && status === "approved" && <div className="care-fields"><label>Confirmed date<input type="date" required min={localDateToday()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Confirmed time (Lusaka)<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label></div>}
      <label>Private follow-up notes<textarea maxLength={4000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      {error && <p role="alert" className="care-error">{error}</p>}{notice && <p role="status" className="care-notice">{notice}</p>}
      <button disabled={busy} className="care-primary">{busy?"Saving…":"Save review"}</button>
    </form></details>
  </article>;
}

export default function StaffCareInbox({visible,onPendingCountChange}:{visible:boolean;onPendingCountChange:(count:number)=>void}) {
  const revision=useDashboardRefresh();
  const [rows,setRows]=useState<CareRequest[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [refresh,setRefresh]=useState(0),[category,setCategory]=useState("all"),[status,setStatus]=useState("pending"),[search,setSearch]=useState("");
  useEffect(()=>{let active=true;async function load(){try{const result=await fetchAllRows((a,b)=>createClient().from("church_care_requests").select("*").neq("kind","prayer").order("created_at",{ascending:false}).order("id").range(a,b));if(result.error)throw result.error;if(active){const data=result.data as CareRequest[];setRows(data);onPendingCountChange(data.filter(r=>r.status==="pending").length);setError("");}}catch{if(active)setError("Requests could not be loaded. Please refresh.");}finally{if(active)setLoading(false);}}void load();return()=>{active=false;};},[revision,refresh,onPendingCountChange]);
  if(!visible)return null;
  const shown=rows.filter(r=>(category==="all" || (category==="care" ? !["visit","appointment"].includes(r.kind) : r.kind===category))&&(status==="all"||r.status===status)&&[r.name,r.subject_name,r.phone].some(v=>(v||"").toLowerCase().includes(search.trim().toLowerCase())));
  return <section className="staff-care-inbox" aria-label="Visits, appointments and church care">
    <div className="care-inbox-heading"><div><h2>Requests &amp; follow-up</h2><p>Updates every 30 seconds while this screen is open. Requests stay private.</p><p>Contact requesters directly to confirm plans or share decisions. Saving a review does not send an email or SMS.</p></div><button className="care-secondary" onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
    <div className="care-metrics"><div><span>New</span><strong>{rows.filter(r=>r.status==="pending").length}</strong></div><div><span>Appointment requests</span><strong>{rows.filter(r=>r.kind==="appointment"&&r.status==="pending").length}</strong></div><div><span>Planned visits</span><strong>{rows.filter(r=>r.kind==="visit"&&r.status!=="closed").length}</strong></div><div><span>Open care concerns</span><strong>{rows.filter(r=>!["visit","appointment"].includes(r.kind)&&r.status!=="closed").length}</strong></div></div>
    <div className="care-filters"><label>Request type<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All requests</option><option value="appointment">Pastor appointments</option><option value="visit">Planned visits</option><option value="care">Church care</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{(Object.keys(labels) as Status[]).map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label><label>Find a request<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or phone"/></label></div>
    {error?<p role="alert" className="care-error">{error}</p>:loading?<p role="status">Loading requests…</p>:!shown.length?<div className="care-empty">No requests match these filters.</div>:shown.map(item=><RequestReview key={item.id} item={item} onSaved={()=>setRefresh(v=>v+1)}/>)}
  </section>;
}
