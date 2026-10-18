"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import EventCalendarLink from "@/components/event-calendar-link";
import {fetchAllRows} from "@/lib/fetch-all-rows";
import {localDateToday} from "@/lib/care-requests";
import PublicChurchAnnouncements from "@/components/public-church-announcements";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";
import { useSiteSettings } from "@/lib/use-site-settings";

type PublishedItem = {
  id: string;
  kind: "theme" | "event" | "photo" | "download";
  title: string;
  description: string;
  theme_month: string | null;
  event_date: string | null;
  event_end_date: string | null;
  recording_year: number | null;
  location: string;
  media_path: string | null;
  media_content_type: string | null;
  media_file_name: string | null;
  created_at: string;
};

export default function PublicSiteContent() {
  const settings = useSiteSettings();
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState(false);
  const [retry,setRetry]=useState(0);


  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);setLoadError(false);
      try {
        const { data, error: queryError } = await fetchAllRows((from,to)=>createClient().from("site_content")
          .select("id,kind,title,description,theme_month,event_date,event_end_date,recording_year,location,media_path,media_content_type,media_file_name,created_at")
          .eq("is_published", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false }).order("id").range(from,to));
        if (!active) return;
        if(queryError)setLoadError(true);else setItems((data ?? []) as PublishedItem[]);
      } catch {
        if(active)setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  const today = localDateToday();
  const month = today.slice(0, 7);
  const theme = items.find((item) => item.kind === "theme" && item.theme_month?.slice(0, 7) === month);
  const events = items.filter((item) => item.kind === "event" && item.event_date && (item.event_end_date ?? item.event_date) >= today).sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).slice(0, 4);
  const photos = items.filter((item) => item.kind === "photo" && item.media_path).slice(0, 8);
  const downloads = items.filter((item) => item.kind === "download" && item.media_path);

  const publicUrl = (item: PublishedItem) => item.media_path ? siteMediaStorage.publicUrl(item.media_path) : "#";
  const downloadUrl = (item: PublishedItem) => {
    const url = new URL(publicUrl(item));
    url.searchParams.set("download", item.media_file_name || item.title);
    return url.toString();
  };


  return <>
    <section id="monthly-theme" className="home-monthly-text" aria-labelledby="monthly-theme-title">
      <div className="home-wrap"><div className="home-monthly-panel"><div className="home-monthly-heading"><p className="home-eyebrow">OUR FOCUS THIS MONTH</p><div className="monthly-heading-actions"><time dateTime={month}>{new Date(`${month}-02T12:00:00`).toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</time></div></div><div className="home-monthly-columns"><div className="home-monthly-message"><span className="home-monthly-rule" aria-hidden="true"/><p className="home-monthly-label">Theme of the month</p><h2 id="monthly-theme-title">{theme?.title ?? "Growing in the Word, together."}</h2></div><aside className="home-monthly-scripture" aria-label="Scripture for the month"><span className="home-scripture-mark" aria-hidden="true">“</span><p className="home-eyebrow">SCRIPTURE FOR THE MONTH</p>{theme?.description ? <blockquote>{theme.description}</blockquote> : <p className="home-scripture-pending">The monthly scripture will be shared here.</p>}</aside></div></div></div>
    </section>
    <section id="announcements" className="home-section home-updates">
      <div className="home-wrap">
        <div className="home-section-heading"><div><p className="home-eyebrow">THE LIFE OF OUR CHURCH</p><h2>{settings.homepage_copy.updates_heading}</h2></div><p>{settings.homepage_copy.updates_intro}</p></div>
        <Link href="/bulletin" className="home-bulletin-link"><span className="home-bulletin-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 5c-3-2-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15"/></svg></span><span className="home-bulletin-copy"><small>THE WEEKLY BULLETIN</small><strong>This week at Zoe</strong><span>A word of encouragement and the week’s notices, together in one place.</span></span><span className="home-bulletin-action">Read the bulletin <span aria-hidden="true">↗</span></span></Link>
        {loadError&&<div role="alert" className="home-content-error"><p>Some church updates could not be loaded. Please try again.</p><button onClick={()=>setRetry(value=>value+1)}>Reload updates ↻</button></div>}
        <PublicChurchAnnouncements />
        <div className="home-calendar-layout">
          <div id="upcoming-events" className="home-events"><p className="home-eyebrow">UPCOMING EVENTS</p><h3>{settings.homepage_copy.calendar_heading}</h3>
            <p className="home-events-intro">{settings.homepage_copy.calendar_intro}</p>
            {events.length ? <div className="home-event-grid">{events.map(event=>{
              const date=new Date(`${event.event_date}T12:00:00`);
              return <article className="home-event" key={event.id}>{!event.media_path && <div className="inspired-event-art" aria-hidden="true"><span>{date.getDate()}{event.event_end_date && event.event_end_date !== event.event_date ? `–${new Date(`${event.event_end_date}T12:00:00`).getDate()}` : ""}</span><small>{date.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</small><b>↗</b></div>}<time dateTime={event.event_date ?? undefined} className="home-event-date"><strong>{date.getDate()}</strong><span>{date.toLocaleDateString("en-GB",{month:"short"}).toUpperCase()}</span></time><div className="home-event-copy"><p className="home-event-meta">{date.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}{event.event_end_date && event.event_end_date !== event.event_date ? ` – ${new Date(`${event.event_end_date}T12:00:00`).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}` : ""}</p><h4>{event.title}</h4><EventCalendarLink event={event}/>{event.location && <p className="home-event-location">{event.location}</p>}{event.description && <p>{event.description}</p>}{event.media_path && <a href={publicUrl(event)} target="_blank" rel="noopener noreferrer" aria-label={`View poster for ${event.title}`}><Image unoptimized src={publicUrl(event)} alt={`Poster for ${event.title}`} width={720} height={540}/></a>}</div></article>;
            })}</div> : <div className="home-event-note" aria-busy={loading}><h4>{loading ? "Loading upcoming events…" : "More gatherings are on the way."}</h4><p>Our next special events will be shared here. In the meantime, join us for our regular services.</p><a href="#service-times" className="home-text-link">View service times <span aria-hidden="true">→</span></a></div>}
          </div>
        </div>
      </div>
    </section>
    {photos.length > 0 && <section id="events" className="home-section"><div className="home-wrap"><div className="home-section-heading"><div><p className="home-eyebrow">LIFE AT ZOE</p><h2>{settings.homepage_copy.gallery_heading}</h2></div><p>{settings.homepage_copy.gallery_intro}</p></div><div className="home-gallery-grid">{photos.map(photo=><figure key={photo.id}><Image unoptimized src={publicUrl(photo)} alt={photo.title} width={640} height={480}/><figcaption>{photo.title}</figcaption></figure>)}</div></div></section>}
    <section className="home-section home-recordings"><div className="home-wrap"><div className="home-section-heading"><div><p className="home-eyebrow">ROOTED IN THE WORD</p><h2>{settings.homepage_copy.sermons_heading}</h2></div><div><p className="home-recording-intro">{settings.homepage_copy.sermons_intro}</p><Link href="/sermons" className="home-text-link">{settings.homepage_copy.sermons_button} <span aria-hidden="true">→</span></Link></div></div>
      {downloads.length > 0 && <div className="home-recording-list">{[...downloads].sort((a,b)=>(b.recording_year ?? 0)-(a.recording_year ?? 0)).slice(0,4).map(item=><article key={item.id} className="home-recording"><div>{item.recording_year && <small>{item.recording_year}</small>}<h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div><div className="home-recording-media">{item.media_content_type?.startsWith("video/") && <video aria-label={item.title} controls preload="none" src={publicUrl(item)}/ >}{item.media_content_type?.startsWith("audio/") && <audio aria-label={item.title} controls preload="none" src={publicUrl(item)}/>}<a href={downloadUrl(item)}>Download <span aria-hidden="true">↓</span></a></div></article>)}</div>}
    </div></section>
  </>;
}

