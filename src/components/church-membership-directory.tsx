"use client";
import {useEffect,useState} from 'react';
import MemberRecordEditor,{type ManagedMember} from "@/components/member-record-editor";
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {fetchAllRows} from '@/lib/fetch-all-rows';
import {useDashboardRefresh} from '@/lib/use-dashboard-refresh';
import '@/app/super-admin/members/members.css';

type Member=ManagedMember;
type Cell={id:number;zone_id:number;name:string;leader:string;is_active:boolean};
type Zone={id:number;name:string;is_active:boolean};
type Register={members:Member[];cells:Cell[];zones:Zone[]};
const PAGE_SIZE=30;
export default function ChurchMembershipDirectory(){
 const [register,setRegister]=useState<Register|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[search,setSearch]=useState(''),[zone,setZone]=useState('all'),[cell,setCell]=useState('all'),[gender,setGender]=useState('all'),[status,setStatus]=useState('active'),[page,setPage]=useState(0),[updated,setUpdated]=useState(''),[notice,setNotice]=useState('');
 const revision=useDashboardRefresh();
 useEffect(()=>{let active=true;void(async()=>{try{
  const db=createClient();
  const [m,c,z]=await Promise.all([
   fetchAllRows((a,b)=>db.from('members').select('id,cell_id,name,gender,age,phone,area,joined_at,is_active,record_version').order('name').order('id').range(a,b)),
   fetchAllRows((a,b)=>db.from('cells').select('id,zone_id,name,leader,is_active').order('name').order('id').range(a,b)),
   fetchAllRows((a,b)=>db.from('zones').select('id,name,is_active').order('name').order('id').range(a,b)),
  ]);
  if(m.error||c.error||z.error)throw Error();
  if(active){setRegister({members:m.data??[],cells:c.data??[],zones:z.data??[]});setError('');setUpdated(new Date().toLocaleTimeString('en-GB',{timeZone:'Africa/Lusaka',hour:'2-digit',minute:'2-digit'}));}
 }catch{if(active)setError('The membership register could not be refreshed. Please try again.');}})();return()=>{active=false;};},[revision,refresh]);
 const cellMap=new Map(register?.cells.map(c=>[c.id,c])),zoneMap=new Map(register?.zones.map(z=>[z.id,z]));
 const query=search.trim().toLocaleLowerCase(),digits=query.replace(/\D/g,'');
 const filtered=(register?.members??[]).filter(m=>{
  const c=cellMap.get(m.cell_id);
  return (status==='all'||m.is_active===(status==='active'))&&(zone==='all'||String(c?.zone_id)===zone)&&(cell==='all'||String(m.cell_id)===cell)&&(gender==='all'||m.gender===gender)&&(!query||[m.name,m.phone,m.area].some(v=>v?.toLocaleLowerCase().includes(query))||Boolean(digits&&digits.length>=3&&(m.phone??'').replace(/\D/g,'').includes(digits)));
 });
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),shown=filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 const change=()=>setPage(0);
 return <main className="membership-page"><div className="membership-wrap">
  <header className="membership-header"><div><p className="membership-eyebrow">SUPER ADMIN · CELL REGISTERS</p><h1>Church membership</h1><p>One church-wide view of the members registered in your cells.</p></div><Link href="/super-admin">Back to dashboard ↗</Link></header>
  <div className="membership-summary"><article><strong>{register?.members.filter(m=>m.is_active).length??'—'}</strong><span>Active members</span></article><article><strong>{register?new Set(register.members.filter(m=>m.is_active).map(m=>m.cell_id)).size:'—'}</strong><span>Cells with active members</span></article><article><strong>{register?.cells.length??'—'}</strong><span>Total cells</span></article></div>
  <p className="membership-source">These are the same Supabase records managed by cell leaders. Approved joining requests appear once added to the cell register. Inactive records remain available through the membership filter. Changes require a reason; only Super Admin can transfer members.</p>
  <section className="membership-panel" aria-label="Membership register">
   <div className="membership-filters"><label>Membership<select value={status} onChange={e=>{setStatus(e.target.value);change();}}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All records</option></select></label><label>Search members<input type="search" value={search} placeholder="Name, phone or area" onChange={e=>{setSearch(e.target.value);change();}}/></label><label>Zone<select value={zone} onChange={e=>{setZone(e.target.value);setCell('all');change();}}><option value="all">All zones</option>{register?.zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>Cell<select value={cell} onChange={e=>{setCell(e.target.value);change();}}><option value="all">All cells</option>{register?.cells.filter(c=>zone==='all'||String(c.zone_id)===zone).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Gender<select value={gender} onChange={e=>{setGender(e.target.value);change();}}><option value="all">All</option><option>Male</option><option>Female</option></select></label></div>
   <div className="membership-result-bar"><p aria-live="polite">{register?`${filtered.length} of ${register.members.length} members`:'Loading register…'}{updated&&<small>Updated {updated} · Lusaka time</small>}</p><button onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
   {notice&&<p role="status" className="membership-source">{notice}</p>}
   {error&&<p role="alert" className="membership-error">{error}{register?' The last loaded records are shown below.':''}</p>}
   {!register&&!error?<p role="status">Loading membership from Supabase…</p>:register&&filtered.length===0?<div className="membership-empty"><h2>{register.members.length?'No matching members':'No members registered yet'}</h2><p>{register.members.length?'Try another search or change the filters.':'As cell leaders register members, they will appear here automatically.'}</p></div>:register&&<div className="membership-table-wrap"><table><caption className="sr-only">Church members from cell registers</caption><thead><tr>{['Member','Gender / age','Phone','Area','Cell / leader','Zone','Registered','Manage'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map(m=>{const c=cellMap.get(m.cell_id);return <tr key={m.id}><td><strong>{m.name}</strong><small>{m.is_active?"Active":"Inactive"}</small></td><td>{m.gender||'—'}<small>{m.age==null?'Age not recorded':`${m.age} years`}</small></td><td>{m.phone||'—'}</td><td>{m.area||'—'}</td><td>{c?.name??'Cell unavailable'}<small>{c?.leader||'Leader not recorded'}</small></td><td>{zoneMap.get(c?.zone_id??-1)?.name??'—'}</td><td>{m.joined_at?new Date(m.joined_at).toLocaleDateString('en-GB',{timeZone:'Africa/Lusaka'}):'—'}</td><td><MemberRecordEditor member={m} onSaved={()=>{setNotice("Member record updated. Change history has been saved.");setRefresh(v=>v+1);}} transferCells={register.cells.filter(c=>c.is_active&&zoneMap.get(c.zone_id)?.is_active)}/></td></tr>;})}</tbody></table></div>}
   {filtered.length>0&&<nav className="membership-pagination" aria-label="Membership pages"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {pages}</span><button disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Next</button></nav>}
  </section>
 </div></main>;
}
