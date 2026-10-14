"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {fetchAllRows} from "@/lib/fetch-all-rows";
import {useDashboardRefresh} from "@/lib/use-dashboard-refresh";
import {currentWeek} from "@/components/zone-weekly-review";
import {reportRange} from "@/components/cell-report-generator";
import {mapReportDetails} from "@/lib/report-details";
import {FullCellReport} from "@/components/full-cell-report";

type Row=Record<string,unknown>;
type Cell={id:number;zone_id:number;name:string;leader:string};
type Zone={id:number;name:string};
type Submission={zone_id:number;submitted_at:string};
const number=(row:Row,key:string)=>Number(row[key]??0);
const sum=(rows:Row[],key:string)=>rows.reduce((total,row)=>total+number(row,key),0);
const hasOutreach=(row:Row)=>["people_reached","tracts","souls_won","team_count","contacts"].some(key=>number(row,key)>0)||Boolean(String(row.evangelism_notes??"").trim() || String(row.evangelism_location??"").trim());

export default function RegionalCellReports(){
 const revision=useDashboardRefresh();
 const [week,setWeek]=useState(currentWeek);
 const [data,setData]=useState<{cells:Cell[];zones:Zone[];attendance:Row[];outreach:Row[];submissions:Submission[]}>({cells:[],zones:[],attendance:[],outreach:[],submissions:[]});
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;async function load(){const db=createClient();try{
  const results=await Promise.all([
   fetchAllRows((a,b)=>db.from("cells").select("id,zone_id,name,leader").eq("is_active",true).order("id").range(a,b)),
   fetchAllRows((a,b)=>db.from("zones").select("id,name").eq("is_active",true).order("id").range(a,b)),
   fetchAllRows((a,b)=>db.from("attendance_reports").select("*").gte("report_date",week.from).lte("report_date",week.to).order("report_date").order("id").range(a,b)),
   fetchAllRows((a,b)=>db.from("attendance_reports").select("*").gte("evangelism_date",week.from).lte("evangelism_date",week.to).order("id").range(a,b)),
   fetchAllRows((a,b)=>db.from("evangelism_reports").select("*").gte("report_date",week.from).lte("report_date",week.to).order("id").range(a,b)),
   fetchAllRows((a,b)=>db.from("zone_weekly_reports").select("zone_id,submitted_at").eq("week_start",week.from).order("id").range(a,b)),
  ]);
  if(results.some(r=>r.error))throw new Error("Reports unavailable");
  if(active){setData({cells:results[0].data??[],zones:results[1].data??[],attendance:results[2].data??[],outreach:[...(results[3].data??[]).filter(hasOutreach).map(r=>({...r,id:`attendance-${r.id}`})),...(results[4].data??[]).map(r=>({...r,id:`evangelism-${r.id}`}))],submissions:results[5].data??[]});setError("");}
 }catch{if(active)setError("Regional reports could not be loaded. Refresh to try again.");}finally{if(active)setLoading(false);}}void load();return()=>{active=false;};},[revision,week.from,week.to]);
 const cells=data.cells.filter(c=>data.zones.some(z=>z.id===c.zone_id));
 const metrics=cells.map(cell=>{const reports=data.attendance.filter(r=>number(r,"cell_id")===cell.id),outreach=data.outreach.filter(r=>number(r,"cell_id")===cell.id);return {cell,reports,outreach,average:reports.length?sum(reports,"attendance")/reports.length:0,reached:sum(outreach,"people_reached")};});
 const ranking=metrics.filter(m=>m.reports.length).sort((a,b)=>b.average-a.average||b.reached-a.reached||a.cell.name.localeCompare(b.cell.name));
 return <section className="rounded-2xl border p-4 sm:p-6 mb-6" aria-label="Regional weekly reports">
  <div className="flex flex-wrap justify-between items-start gap-4"><div><h2 className="font-bold text-xl">Regional weekly reports</h2><p className="text-sm opacity-70 mt-1">Live cell reports across every active zone. Updates automatically within 30 seconds.</p></div><label className="text-sm font-semibold">Choose report week<input className="block border rounded-lg p-2 mt-1 max-w-full bg-transparent" aria-label="Regional report week" type="date" value={week.from} onChange={e=>{if(e.target.value){const next=reportRange("week",e.target.value,"","");if(next.from!==week.from){setLoading(true);setWeek(next);}}}}/></label></div>
  <p className="text-sm my-4">{week.from} to {week.to}</p>
  {loading?<p role="status">Loading regional reports…</p>:error?<p role="alert">{error}</p>:<>
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{[["Cells reported",`${metrics.filter(m=>m.reports.length).length} / ${cells.length}`],["Zones submitted",`${data.submissions.filter(s=>data.zones.some(z=>z.id===s.zone_id)).length} / ${data.zones.length}`],["Attendance across meetings",sum(data.attendance.filter(r=>cells.some(c=>c.id===number(r,"cell_id"))),"attendance")],["People reached",metrics.reduce((s,m)=>s+m.reached,0)]].map(([label,value])=><div key={label} className="border rounded-xl p-3"><p className="text-xs opacity-70">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}</div>
   <h3 className="font-bold">Best-performing cells in the region</h3><p className="text-sm opacity-70 mt-1 mb-3">Ranked by average meeting attendance, then people reached. Cells without attendance reports are excluded.</p>
   {ranking.length?<ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">{ranking.slice(0,5).map((m,i)=><li key={m.cell.id} className="border rounded-xl p-3"><b>{i+1}. {m.cell.name}</b><p className="text-xs opacity-70 mt-1">{data.zones.find(z=>z.id===m.cell.zone_id)?.name}</p><p className="text-sm mt-2">Average attendance {m.average.toFixed(1)} · Reached {m.reached}</p><p className="text-xs opacity-70">{m.reports.length} meeting report(s)</p></li>)}</ol>:<p className="text-sm my-4">No attendance reports to rank for this week.</p>}
   <h3 className="font-bold mb-3">Reports by zone and cell</h3><p className="text-sm opacity-70 mb-3">Live reports can change after a zone submits. The submitted summary below preserves what the Zone Leader sent.</p>
   {data.zones.map(zone=>{const list=metrics.filter(m=>m.cell.zone_id===zone.id),submission=data.submissions.find(s=>s.zone_id===zone.id);return <details key={zone.id} className="border rounded-xl p-3 sm:p-4 mb-3"><summary className="cursor-pointer font-bold">{zone.name}<span className="block text-xs font-normal mt-1">{list.filter(m=>m.reports.length).length}/{list.length} cells reported · {submission?`Zone summary submitted ${new Date(submission.submitted_at).toLocaleString()}`:"Zone summary not submitted"}</span></summary>{list.map(m=><details key={m.cell.id} className="border rounded-lg p-3 mt-3"><summary className="cursor-pointer font-semibold">{m.cell.name}<span className="block text-xs font-normal mt-1">{m.reports.length?`${m.reports.length} meeting report(s)`:"Attendance not reported"} · {m.outreach.length} outreach report(s)</span></summary><p className="text-sm mt-3">Leader: {m.cell.leader||"Not assigned"}</p>{!m.reports.length&&<p className="text-sm my-3">No attendance report for this week.</p>}{m.reports.map(r=><FullCellReport key={String(r.id)} leader={m.cell.leader} report={{...mapReportDetails(r),id:String(r.id),date:String(r.report_date),attendance:number(r,"attendance"),visitors:number(r,"visitors"),offeringAmount:number(r,"offering_amount"),evangelismDate:r.evangelism_date?String(r.evangelism_date):null,peopleReached:number(r,"people_reached"),tracts:number(r,"tracts"),soulsWon:number(r,"souls_won"),teamCount:number(r,"team_count"),contacts:number(r,"contacts"),evangelismNotes:String(r.evangelism_notes??"")}}/>)}{m.outreach.length>0&&<><h4 className="font-bold mt-3">Evangelism this week</h4>{m.outreach.map(r=><div key={String(r.id)} className="text-sm border-b py-3"><p>{String(r.evangelism_date??r.report_date)} · Reached {number(r,"people_reached")} · Tracts {number(r,"tracts")} · Souls {number(r,"souls_won")} · Team {number(r,"team_count")} · Contacts {number(r,"contacts")}</p><p className="whitespace-pre-wrap">{String(r.notes??r.evangelism_notes??"")}</p></div>)}</>}</details>)}{!list.length&&<p className="text-sm mt-3">No active cells in this zone.</p>}</details>;})}
  </>}
 </section>;
}
