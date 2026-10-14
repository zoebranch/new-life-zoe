"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteImage } from "@/components/site-image";
import { createClient } from "@/lib/supabase/client";
import { mapCell } from "@/lib/church-data";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { useSiteSettings } from "@/lib/use-site-settings";
import "../home.css";
import "./cells.css";

type DirectoryZone = { id:number; name:string };
export default function CellsPage() {
  const settings=useSiteSettings();
  const [search,setSearch]=useState("");
  const [zoneId,setZoneId]=useState("");
  const [cells,setCells]=useState<ReturnType<typeof mapCell>[]>([]);
  const [zones,setZones]=useState<DirectoryZone[]>([]);
  const [loading,setLoading]=useState(true);
  const [directoryError,setDirectoryError]=useState("");
  const [retry,setRetry]=useState(0);
  const [menuOpen,setMenuOpen]=useState(false);
  const [view,setView]=useState<"cards" | "list">("cards");
  useEffect(()=>{
    let active=true;
    async function loadCells(){
      setLoading(true);setDirectoryError("");
      try{
        const supabase=createClient();
        const zoneResult=await fetchAllRows((from,to)=>supabase.from("zones").select("id,name").eq("is_active",true).order("name").order("id").range(from,to));
        if(zoneResult.error||!zoneResult.data)throw Error("Directory unavailable");
        const activeZones=zoneResult.data as DirectoryZone[];
        const result=activeZones.length ? await fetchAllRows((from,to)=>supabase.from("cells")
          .select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count,is_active")
          .eq("is_active",true).in("zone_id",activeZones.map(zone=>zone.id)).order("name").order("id").range(from,to)) : {data:[],error:null};
        if(result.error||!result.data)throw Error("Directory unavailable");
        if(active){setCells(result.data.map(mapCell));setZones(activeZones);}
      }catch{if(active){setCells([]);setZones([]);setDirectoryError("We couldn’t load the cell directory. Please try again.");}}
      finally{if(active)setLoading(false);}
    }
    void loadCells();return()=>{active=false;};
  },[retry]);
  const term=search.trim().toLowerCase();
  const zoneNames=new Map(zones.map(zone=>[zone.id,zone.name]));
  const filtered=cells.filter(cell=>(!zoneId||cell.zoneId===Number(zoneId))&&[cell.name,cell.area,cell.leader,zoneNames.get(cell.zoneId)??""].some(value=>value.toLowerCase().includes(term)));
  const availableZones=zones.filter(zone=>cells.some(cell=>cell.zoneId===zone.id));
  const clearFilters=()=>{setSearch("");setZoneId("");};
  return <main className="zoe-home cells-page">
    <a href="#cell-directory" className="home-skip">Skip to cell directory</a>
    <header className="home-header"><div className="home-wrap home-header-inner">
      <Link href="/" className="home-brand"><SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="" width={48} height={48}/><span><strong>{settings.church_name}</strong><small>{settings.branch_name}</small></span></Link>
      <button className="home-menu-toggle" aria-label={menuOpen?"Close navigation":"Open navigation"} aria-controls="cells-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?"Close ×":"Menu ☰"}</button>
      <nav id="cells-navigation" aria-label="Main navigation" className={`home-navigation ${menuOpen?"is-open":""}`} onKeyDown={event=>{if(event.key==="Escape")setMenuOpen(false);}}><Link href="/">Home</Link><Link href="/cells" aria-current="page">Our cells</Link><Link href="/sermons">Sermons</Link><Link href="/leaders" className="home-login">Leader login <span aria-hidden="true">↗</span></Link></nav>
    </div></header>
    <section className="cells-intro"><div className="home-wrap cells-intro-inner"><div><p className="home-eyebrow">FIND YOUR COMMUNITY</p><h1>There’s a place<br/>for you here.</h1></div><div><p>Grow in the Word, share life, and pray together. Find a cell near you and take your next step into church community.</p><a href="#cell-directory" className="home-text-link">Explore our cells <span aria-hidden="true">↓</span></a></div></div></section>
    <section className="cells-join-guide home-wrap" aria-labelledby="join-guide-title"><div><p className="home-eyebrow">NEW TO CELLS?</p><h2 id="join-guide-title">How to join a cell</h2><p>No account or password needed.</p></div><ol><li><strong>Find your cell</strong><span>Search your area or choose a zone. Check the leader and meeting times.</span></li><li><strong>Send your details</strong><span>Select “Join this cell” and fill in your name, phone number, gender, and age.</span></li><li><strong>Connect with the leader</strong><span>Submit your request. The cell leader will review it and help you join the group.</span></li></ol></section>
    <section id="cell-directory" className="cells-directory home-wrap" aria-label="Cell directory">
      <div className="cells-directory-heading"><div><p className="home-eyebrow">CONNECT NEAR YOU</p><h2>Find a cell.</h2></div><p>Search by cell, area, leader, or zone.</p></div>
      <form className="cells-filters" role="search" onSubmit={event=>event.preventDefault()}>
        <div className="cells-search"><label htmlFor="cell-search">Search the directory</label><div className="cells-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input id="cell-search" type="search" placeholder="Try an area or cell name" value={search} onChange={event=>setSearch(event.target.value)}/></div></div>
        <div className="cells-zone-filter"><label htmlFor="cell-zone">Choose a zone</label><select id="cell-zone" value={zoneId} onChange={event=>setZoneId(event.target.value)} disabled={loading||!!directoryError}><option value="">All zones</option>{availableZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></div>
      </form>
      <div className="cells-results-bar"><div className="cells-view-toggle" role="group" aria-label="Directory view"><button type="button" aria-pressed={view==="cards"} onClick={()=>setView("cards")}><span aria-hidden="true">▦</span> Cards</button><button type="button" aria-pressed={view==="list"} onClick={()=>setView("list")}><span aria-hidden="true">☰</span> List</button></div><p aria-live="polite" role="status">{loading?"Loading the cell directory…":directoryError?"Directory unavailable":`${filtered.length} ${filtered.length===1?"cell":"cells"}${term||zoneId?" found":" to connect with"}`}</p>{(search||zoneId)&&<button onClick={clearFilters}>Clear filters ×</button>}</div>
      {loading?<div className="cells-loading" aria-hidden="true">{[0,1,2].map(index=><div key={index}><span/><span/><span/></div>)}</div>:directoryError?<div className="cells-empty" role="alert"><h3>The directory is temporarily unavailable.</h3><p>{directoryError}</p><button className="home-button home-button-red" onClick={()=>setRetry(value=>value+1)}>Try again <span aria-hidden="true">↻</span></button></div>:filtered.length===0?<div className="cells-empty"><h3>{cells.length?"Let’s try another search.":"Connect with our church."}</h3><p>{cells.length?"No cells match these filters. Try a different area or browse all available cells.":"Cell meeting details will be shared here as they become available."}</p>{cells.length>0&&<button className="home-button home-button-red" onClick={clearFilters}>View all cells <span aria-hidden="true">→</span></button>}</div>:<div className={`cells-grid ${view==="list"?"cells-list":""}`}>{filtered.map(cell=><article className="cell-card" key={cell.id}>
        <div className="cell-card-top"><p className="cell-zone">{zoneNames.get(cell.zoneId)||"Church community"}</p><span aria-hidden="true">↗</span></div><h3>{cell.name}</h3>{cell.area&&<p className="cell-area">{cell.area}</p>}
        <dl className="cell-details"><div><dt>We gather</dt><dd>{cell.meetingDay}<br/><span>{cell.meetingTime}</span></dd></div><div><dt>Cell leader</dt><dd>{cell.leader||"Contact the church for details"}</dd></div></dl>
        <Link href={`/cells/${cell.id}/join`} className="cell-join" aria-label={`Request to join ${cell.name}`}>Join this cell <span aria-hidden="true">→</span></Link>
      </article>)}</div>}
      <div className="cells-next-step"><div><p className="home-eyebrow">YOUR NEXT STEP</p><h3>Ready to join?</h3></div><p>Choose a cell and send a request. The cell leader will review your details and help you connect with the group.</p></div>
    </section>
    <footer className="cells-footer"><div className="home-wrap"><p>{settings.church_name} · {settings.branch_name}</p><Link href="/">Back to the website <span aria-hidden="true">↗</span></Link></div></footer>
  </main>;
}

