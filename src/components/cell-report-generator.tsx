"use client";
import { useState } from "react";
import type { Cell, Member } from "@/data/cells";
import { FullCellReport, type FullReport } from "@/components/full-cell-report";

type EvangelismRecord = { id: string | number; date: string; peopleReached: number; tracts: number; soulsWon: number; teamCount: number; contacts?: number; notes?: string };
type Period = "week" | "month" | "year" | "custom";
const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

export function reportRange(period: Period, anchor: string, from: string, to: string) {
  if (period === "custom") return { from, to };
  const date = new Date(`${anchor}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return { from: "", to: "" };
  const year = date.getFullYear(), month = date.getMonth();
  if (period === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (period === "month") return { from: formatDate(new Date(year,month,1)), to: formatDate(new Date(year,month+1,0)) };
  date.setDate(date.getDate() - (date.getDay()+6)%7);
  const end = new Date(date); end.setDate(end.getDate()+6);
  return { from: formatDate(date), to: formatDate(end) };
}

export function CellReportGenerator({ cell, reports, evangelism, members }: { cell: Cell; reports: FullReport[]; evangelism: EvangelismRecord[]; members: Member[] }) {
  const today = formatDate(new Date());
  const [period,setPeriod] = useState<Period>("month");
  const [anchor,setAnchor] = useState(today);
  const [from,setFrom] = useState(today.slice(0,7)+"-01");
  const [to,setTo] = useState(today);
  const [generated,setGenerated] = useState<{from:string;to:string} | null>(null);
  const [single,setSingle] = useState<FullReport | null>(null);
  const range = reportRange(period,anchor,from,to);
  const valid = Boolean(range.from && range.to && range.from <= range.to);
  const included = generated ? reports.filter(r=>r.date>=generated.from && r.date<=generated.to) : [];
  const evan = generated ? evangelism.filter(r=>r.date>=generated.from && r.date<=generated.to) : [];
  const sum = (key: "attendance" | "visitors" | "offeringAmount") => included.reduce((total,r)=>total+r[key],0);
  const inputClass = "mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded-xl p-3 text-white text-sm";
  const preview = generated !== null || single !== null;
  return <section className="bg-[#151515] border border-[#333] rounded-3xl p-6 mb-6">
    <div className="print-hide"><h2 className="font-bold text-lg">Generate detailed cell report</h2><p className="text-xs text-gray-400 mt-1">Choose any week (Monday–Sunday), month, year, or custom range covering several months.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label>Report period<select aria-label="Report period" value={period} onChange={e=>setPeriod(e.target.value as Period)} className={inputClass}><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom / several months</option></select></label>
        {period!=="custom" ? <label>Date within the desired {period}<input aria-label="Period reference date" type="date" value={anchor} onChange={e=>setAnchor(e.target.value)} className={inputClass}/></label> : <><label>From<input aria-label="Detailed report start date" type="date" value={from} onChange={e=>setFrom(e.target.value)} className={inputClass}/></label><label>To<input aria-label="Detailed report end date" type="date" value={to} onChange={e=>setTo(e.target.value)} className={inputClass}/></label></>}
      </div><p className="text-xs mt-3">{valid ? `${range.from} to ${range.to}` : "Choose a valid date range."}</p>
      <button disabled={!valid} onClick={()=>{setGenerated(range);setSingle(null);}} className="mt-3 rounded-full bg-white text-black px-5 py-3 font-bold disabled:opacity-40">Generate Report</button>
      <details className="mt-5"><summary className="cursor-pointer font-bold text-sm">View full individual reports ({reports.length})</summary>{reports.map(r=><button key={r.id} onClick={()=>{setSingle(r);setGenerated(null);}} className="block mt-2 text-left border border-[#444] p-3 rounded-xl w-full">View Full Report · {r.date} · Attendance {r.attendance}</button>)}</details>
    </div>
    {preview && <><div className="print-hide flex flex-wrap gap-3 mt-5"><button onClick={()=>window.print()} className="bg-green-700 rounded-full px-5 py-3 font-bold">Print / Save as PDF</button><button onClick={()=>{setGenerated(null);setSingle(null);}} className="rounded-full border px-5 py-3">Close preview</button></div>
      <article data-print-report className="mt-5 bg-white text-black rounded-xl p-6">
        <header><p className="text-xs">New Life Christian Center · Zoe Branch</p><h2 className="font-bold text-2xl mt-1">{cell.name} · Detailed Cell Report</h2><p>Area: {cell.area} · Leader: {cell.leader}</p><p>{single ? `Individual report: ${single.date}` : `Period: ${generated?.from} to ${generated?.to}`}</p><p className="text-xs">Generated: {new Date().toLocaleString()}</p></header>
        {single ? <FullCellReport report={single} leader={cell.leader}/> : <>
          <section className="my-5"><h3 className="font-bold">Period summary</h3><p>{included.length} attendance reports · Total attendance across meetings: {sum("attendance")} · Average attendance: {included.length ? (sum("attendance")/included.length).toFixed(1) : "0"} · Visitors across meetings: {sum("visitors")} · Offering total: {sum("offeringAmount").toFixed(2)}</p><p>Evangelism reports: {evan.length} · Reached: {evan.reduce((s,r)=>s+r.peopleReached,0)} · Tracts: {evan.reduce((s,r)=>s+r.tracts,0)} · Souls won through evangelism: {evan.reduce((s,r)=>s+r.soulsWon,0)}</p><p className="text-xs mt-2">Attendance is included by meeting date; evangelism is included by evangelism date. Attendance totals count repeat attendance across meetings.</p></section>
          <h3 className="font-bold">Full meeting reports</h3>{included.length ? included.map(r=><FullCellReport key={r.id} report={r} leader={cell.leader}/>) : <p>No attendance reports in this period.</p>}
          <section className="mt-5"><h3 className="font-bold">Evangelism in this period</h3>{evan.length ? evan.map(r=><div key={r.id} className="border-b py-3"><p>{r.date} · Reached {r.peopleReached} · Tracts {r.tracts} · Souls {r.soulsWon} · Team {r.teamCount} · Contacts {r.contacts ?? 0}</p><p className="whitespace-pre-wrap">{r.notes || "No notes recorded"}</p></div>) : <p>No evangelism reports in this period.</p>}</section>
        </>}
        <section className="mt-5"><h3 className="font-bold">Current full member register ({members.length})</h3><p className="text-xs mb-2">Current membership at generation time.</p><table className="w-full text-xs border-collapse"><thead><tr>{["Name","Gender","Age","Phone","Area","Joined"].map(label=><th key={label} className="border p-2 text-left">{label}</th>)}</tr></thead><tbody>{members.map(m=><tr key={m.id}><td className="border p-2">{m.name}</td><td className="border p-2">{m.gender}</td><td className="border p-2">{m.age}</td><td className="border p-2">{m.phone || "—"}</td><td className="border p-2">{m.area || "—"}</td><td className="border p-2">{m.joinedAt.slice(0,10)}</td></tr>)}</tbody></table>{!members.length && <p>No registered members.</p>}</section>
      </article></>}
  </section>;
}
