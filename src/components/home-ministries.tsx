"use client";
import Link from "next/link";
import {ministries} from "@/lib/ministries";
import {useSiteSettings} from "@/lib/use-site-settings";
import "@/app/ministries.css";
export default function HomeMinistries(){
 const {homepage_copy:copy}=useSiteSettings();
 return <section id="ministries" className="home-section home-ministries" aria-labelledby="ministries-heading"><div className="home-wrap">
  <div className="home-section-heading"><div><p className="home-eyebrow">FIND YOUR PLACE</p><h2 id="ministries-heading">{copy.ministries_heading}</h2></div><p>{copy.ministries_intro}</p></div>
  <div className="ministry-grid">{ministries.map((ministry,index)=><article className={`ministry-card ministry-card-${index}`} key={ministry.id}><span className="ministry-number" aria-hidden="true">0{index+1}</span><h3>{ministry.name}</h3><p>{copy[`ministry_${ministry.id.replace("-","_")}_intro` as "ministry_youth_intro"|"ministry_women_intro"|"ministry_men_intro"|"ministry_praise_team_intro"]}</p><Link className="ministry-join" href={`/ministries/${ministry.id}/join`}>Join {ministry.name}<span aria-hidden="true">↗</span></Link></article>)}</div>
  <p className="ministry-guidance">Choose a ministry and send your details. The church will get in touch to help you connect.</p>
 </div></section>;
}
