"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteImage } from "@/components/site-image";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";
import { useSiteSettings } from "@/lib/use-site-settings";
import {fetchAllRows} from '@/lib/fetch-all-rows';

type Sermon = {
  id: string;
  title: string;
  description: string;
  recording_year: number;
  media_path: string;
  media_content_type: string | null;
  media_file_name: string | null;
};

export default function SermonsPage() {
  const settings = useSiteSettings();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search,setSearch]=useState('');
  const [year,setYear]=useState('all');
  const [retry,setRetry]=useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);setError('');
      try {
        const { data, error: queryError } = await fetchAllRows((from,to)=>createClient().from("site_content")
          .select("id,title,description,recording_year,media_path,media_content_type,media_file_name")
          .eq("kind", "download").eq("is_published", true)
          .not('media_path','is',null)
          .order("recording_year", { ascending: false }).order("title").order('id').range(from,to));
        if (!active) return;
        if (queryError) setError("The sermon archive is temporarily unavailable.");
        else setSermons((data ?? []) as Sermon[]);
      } catch {
        if (active) setError("The sermon archive is temporarily unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  const years = useMemo(() => [...new Set(sermons.map((sermon) => sermon.recording_year))].sort((a, b) => b - a), [sermons]);
  const term=search.trim().toLocaleLowerCase();
  const filtered=sermons.filter(s=>(year==='all'||String(s.recording_year)===year)&&(!term||`${s.title} ${s.description??''}`.toLocaleLowerCase().includes(term)));
  const shownYears=years.filter(y=>filtered.some(s=>s.recording_year===y));
  function downloadUrl(sermon: Sermon) {
    const url = new URL(siteMediaStorage.publicUrl(sermon.media_path));
    url.searchParams.set("download", sermon.media_file_name || sermon.title);
    return url.toString();
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <a href="#sermon-archive" className="sr-only focus:not-sr-only focus:bg-white focus:text-black focus:p-4">Skip to sermons</a>
      <header className="bg-white text-black px-5 md:px-10 min-h-16 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3.5 min-w-0">
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt={settings.branch_name} width={42} height={42} className="w-[42px] h-[42px] object-contain" />
          <span className="font-black text-[10px] sm:text-xs">{settings.church_name} <span className="block text-[#E10600] mt-1">{settings.branch_name}</span></span>
        </Link>
        <Link href="/" className="bg-black text-white text-xs px-4 py-3 rounded-full font-bold shrink-0">← Home</Link>
      </header>

      <section id="sermon-archive" className="max-w-5xl mx-auto px-5 py-12 md:py-24">
        <p className="text-[#E10600] font-black tracking-[0.22em] text-[10px] mb-3">LISTEN AGAIN</p>
        <h1 className="text-4xl md:text-5xl font-black">Sermon Archive</h1>
        <p className="text-gray-400 mt-3">Listen to or download recordings organized by the year they were recorded.</p>
        <form role="search" onSubmit={e=>e.preventDefault()} className="grid sm:grid-cols-[1fr_180px] gap-4 mt-8"><label className="text-sm text-gray-300">Search recordings<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title or message" className="block w-full mt-2 p-3 border border-white/20 rounded-xl bg-[#151515] text-white"/></label><label className="text-sm text-gray-300">Recording year<select value={year} onChange={e=>setYear(e.target.value)} className="block w-full mt-2 p-3 border border-white/20 rounded-xl bg-[#151515] text-white"><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></form>
        {error && <div role="alert" className="mt-8 rounded-xl bg-red-950/40 p-4 text-sm text-red-300"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)} className="mt-3 py-2 underline font-bold">Try again ↻</button></div>}
        {loading ? <p role="status" className="mt-8 text-gray-400">Loading sermon archive…</p> : error ? null : years.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#151515] p-6 md:p-8">
            <h2 className="font-bold text-lg">No sermons have been published yet</h2>
            <p className="text-gray-400 text-sm mt-2">Published sermon recordings will appear here under their recording year.</p>
          </div>
        ) : filtered.length===0?<div className="mt-10 rounded-2xl border border-white/10 p-6"><h2 className="font-bold">No recordings match your search.</h2><p className="mt-2 text-sm text-gray-400">Try another word or browse all recording years.</p><button className="mt-4 py-3 font-bold underline" onClick={()=>{setSearch('');setYear('all');}}>Clear filters</button></div>:<div className="mt-10 space-y-10">
          <p role="status" className="text-sm text-gray-400">{filtered.length} {filtered.length===1?'recording':'recordings'}</p>
          {shownYears.map((year) => <section key={year} aria-labelledby={`sermon-year-${year}`}>
            <h2 id={`sermon-year-${year}`} className="text-2xl font-black mb-4">{year}</h2>
            <div className="grid gap-3">
              {filtered.filter((sermon) => sermon.recording_year === year).map((sermon) => <article key={sermon.id} className="rounded-xl border border-white/10 bg-[#151515] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">{sermon.title}</h3>
                  {sermon.description && <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{sermon.description}</p>}
                  {sermon.media_content_type?.startsWith("audio/") && <audio aria-label={sermon.title} controls preload="none" className="mt-3 max-w-full" src={siteMediaStorage.publicUrl(sermon.media_path)} />}
                  {sermon.media_content_type?.startsWith("video/") && <video aria-label={sermon.title} controls preload="none" className="mt-3 max-h-64 max-w-full rounded-lg" src={siteMediaStorage.publicUrl(sermon.media_path)} />}
                </div>
                <a href={downloadUrl(sermon)} aria-label={`Download ${sermon.title}`} className="inline-flex justify-center rounded-full bg-[#E10600] px-5 py-3 text-sm font-bold shrink-0">Download</a>
              </article>)}
            </div>
          </section>)}
        </div>}
      </section>
    </main>
  );
}
