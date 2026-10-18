"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Announcement={id:string;title:string;body:string;category:string};
const categories:Record<string,string>={general:"Church news",bereavement:"Remembering together",newborn:"A new arrival",hospital:"Care & support",other:"Church family"};
export default function PublicChurchAnnouncements(){
 const[rows,setRows]=useState<Announcement[]>([]);
 useEffect(()=>{let active=true;async function load(){try{const{data,error}=await createClient().rpc("list_public_church_announcements");if(active&&!error)setRows((data||[]) as Announcement[]);}catch{/* Keep the section hidden if unavailable. */}}void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load();},30000);return()=>{active=false;clearInterval(timer);};},[]);
 if(!rows.length)return null;
 return <section className="public-church-news" aria-labelledby="public-church-news-heading"><p className="home-eyebrow">OUR CHURCH FAMILY</p><h3 id="public-church-news-heading">News &amp; care announcements</h3><div className="public-church-news-grid">{rows.map(row=><article key={row.id}><p className="home-eyebrow">{categories[row.category]||"Church news"}</p><h4>{row.title}</h4><p className="public-church-news-body">{row.body}</p></article>)}</div></section>;
}
