"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteImage } from "@/components/site-image";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";
import { useSiteSettings } from "@/lib/use-site-settings";

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

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: queryError } = await createClient().from("site_content")
          .select("id,title,description,recording_year,media_path,media_content_type,media_file_name")
          .eq("kind", "download").eq("is_published", true)
          .order("recording_year", { ascending: false }).order("title");
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
  }, []);

  const years = useMemo(() => [...new Set(sermons.map((sermon) => sermon.recording_year))].sort((a, b) => b - a), [sermons]);
  function downloadUrl(sermon: Sermon) {
    const url = new URL(siteMediaStorage.publicUrl(sermon.media_path));
    url.searchParams.set("download", sermon.media_file_name || sermon.title);
    return url.toString();
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="bg-white text-black px-5 md:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3.5">
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt={settings.branch_name} width={42} height={42} className="w-[42px] h-[42px] object-contain" />
          <span className="font-black text-xs">{settings.church_name} <span className="text-[#E10600]">· {settings.branch_name}</span></span>
        </Link>
        <Link href="/" className="bg-black text-white text-xs px-4 py-2 rounded-full font-bold">← Home</Link>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-16 md:py-24">
        <p className="text-[#E10600] font-black tracking-[0.22em] text-[10px] mb-3">LISTEN AGAIN</p>
        <h1 className="text-4xl md:text-5xl font-black">Sermon Archive</h1>
        <p className="text-gray-400 mt-3">Listen to or download recordings organized by the year they were recorded.</p>
        {error && <p role="alert" className="mt-8 rounded-xl bg-red-950/40 p-4 text-sm text-red-300">{error}</p>}
        {loading ? <p className="mt-8 text-gray-400">Loading sermon archive…</p> : years.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#151515] p-6 md:p-8">
            <h2 className="font-bold text-lg">No sermons have been published yet</h2>
            <p className="text-gray-400 text-sm mt-2">Published sermon recordings will appear here under their recording year.</p>
          </div>
        ) : <div className="mt-10 space-y-10">
          {years.map((year) => <section key={year} aria-labelledby={`sermon-year-${year}`}>
            <h2 id={`sermon-year-${year}`} className="text-2xl font-black mb-4">{year}</h2>
            <div className="grid gap-3">
              {sermons.filter((sermon) => sermon.recording_year === year).map((sermon) => <article key={sermon.id} className="rounded-xl border border-white/10 bg-[#151515] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">{sermon.title}</h3>
                  {sermon.description && <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{sermon.description}</p>}
                  {sermon.media_content_type?.startsWith("audio/") && <audio controls preload="metadata" className="mt-3 max-w-full" src={siteMediaStorage.publicUrl(sermon.media_path)} />}
                  {sermon.media_content_type?.startsWith("video/") && <video controls preload="metadata" className="mt-3 max-h-64 max-w-full rounded-lg" src={siteMediaStorage.publicUrl(sermon.media_path)} />}
                </div>
                <a href={downloadUrl(sermon)} className="inline-flex justify-center rounded-full bg-[#E10600] px-5 py-2.5 text-sm font-bold">Download</a>
              </article>)}
            </div>
          </section>)}
        </div>}
      </section>
    </main>
  );
}
