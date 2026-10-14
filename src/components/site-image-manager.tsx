"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";
import type { PublicSiteImageSlot } from "@/components/site-image";

type ImageRecord = {
  slot: PublicSiteImageSlot;
  media_path: string;
  media_content_type: string;
  media_file_name: string;
  updated_at: string;
};

const slots: Array<{
  id: PublicSiteImageSlot;
  title: string;
  description: string;
  fallbackSrc: string;
  shape: string;
}> = [
  { id: "homepage-hero", title: "Homepage hero", description: "The large welcome image at the top of the public homepage.", fallbackSrc: "/hero.jpg", shape: "aspect-[16/9]" },
  { id: "church-logo", title: "Church logo", description: "The logo shown in the public website and leader screens.", fallbackSrc: "/logo.png", shape: "aspect-square max-w-44" },
];

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const maxUploadBytes = 12 * 1024 * 1024;

export default function SiteImageManager() {
  const [current, setCurrent] = useState<Partial<Record<PublicSiteImageSlot, ImageRecord>>>({});
  const [files, setFiles] = useState<Partial<Record<PublicSiteImageSlot, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<PublicSiteImageSlot, string>>>({});
  const previewUrls = useRef<Partial<Record<PublicSiteImageSlot, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PublicSiteImageSlot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => () => {
    Object.values(previewUrls.current).forEach((url) => { if (url) URL.revokeObjectURL(url); });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadImages() {
      const { data, error: queryError } = await createClient().from("site_images")
        .select("slot,media_path,media_content_type,media_file_name,updated_at");
      if (!active) return;
      if (queryError) setError("Image settings could not load. Apply the website content migration, then refresh.");
      else {
        const next: Partial<Record<PublicSiteImageSlot, ImageRecord>> = {};
        for (const row of (data ?? []) as ImageRecord[]) next[row.slot] = row;
        setCurrent(next);
      }
      setLoading(false);
    }
    void loadImages().catch(() => {
      if (active) {
        setError("Image settings could not load. Apply the website content migration, then refresh.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  async function saveImage(slot: PublicSiteImageSlot) {
    const file = files[slot];
    if (!file) { setError("Choose an image before saving."); return; }
    if (!allowedTypes.includes(file.type)) { setError("Choose a JPG, PNG, WebP, or GIF image."); return; }
    if (file.size > maxUploadBytes) { setError("Images must be 12 MB or smaller."); return; }

    setSaving(slot);
    setError("");
    setNotice("");
    let uploadedPath: string | null = null;
    try {
      const uploaded = await siteMediaStorage.upload(file, "photo");
      uploadedPath = uploaded.path;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your Super Admin session has ended. Sign in again.");
      const { error: saveError } = await supabase.from("site_images").upsert({
        slot,
        media_path: uploaded.path,
        media_content_type: uploaded.contentType,
        media_file_name: uploaded.fileName,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        is_published: true,
      }, { onConflict: "slot" });
      if (saveError) throw saveError;

      const previousPath = current[slot]?.media_path;
      setCurrent((previous) => ({ ...previous, [slot]: {
        slot,
        media_path: uploaded.path,
        media_content_type: uploaded.contentType,
        media_file_name: uploaded.fileName,
        updated_at: new Date().toISOString(),
      } }));
      setFiles((previous) => ({ ...previous, [slot]: undefined }));
      uploadedPath = null;
      let cleanupWarning = false;
      if (previousPath) {
        try { await siteMediaStorage.remove(previousPath); }
        catch { cleanupWarning = true; }
      }
      setNotice(cleanupWarning
        ? "Image updated. The previous file could not be cleaned up from storage."
        : `${slots.find((item) => item.id === slot)?.title} updated across the website.`);
    } catch (saveError) {
      if (uploadedPath) {
        try { await siteMediaStorage.remove(uploadedPath); } catch { /* Keep the save error visible. */ }
      }
      setError(saveError instanceof Error ? saveError.message : "The image could not be saved. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return <section className="mb-7 rounded-[24px] border border-white/10 bg-[#151515] p-5 md:p-6" aria-labelledby="site-images-heading">
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E10600]">Brand & homepage</p>
      <h2 id="site-images-heading" className="mt-2 text-lg font-black">Website Images</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400">Replace the fixed images used across the public website. Uploads and image settings are saved in Supabase, not in this browser. JPG, PNG, WebP, or GIF · up to 12 MB.</p>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-green-900 bg-green-950/30 p-3 text-sm text-green-200">{notice}</p>}
    <div className="grid gap-4 md:grid-cols-3">
      {slots.map((item) => {
        const record = current[item.id];
        const preview = previews[item.id] ?? (record ? siteMediaStorage.publicUrl(record.media_path) : item.fallbackSrc);
        return <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
          <div className={`relative mx-auto w-full overflow-hidden rounded-xl border border-white/10 bg-black ${item.shape}`}>
            <Image unoptimized src={preview} alt={`${item.title} preview`} fill sizes="(max-width: 768px) 90vw, 30vw" className={item.id === "church-logo" ? "object-contain p-4" : "object-cover"} />
          </div>
          <h3 className="mt-4 font-bold text-sm">{item.title}</h3>
          <p className="mt-1 min-h-10 text-[11px] leading-relaxed text-gray-400">{item.description}</p>
          {record && !files[item.id] && <p className="mt-2 truncate text-[10px] text-gray-500">Current: {record.media_file_name}</p>}
          <label className="mt-3 block text-[11px] font-bold text-gray-300">Choose replacement image
            <input type="file" accept={allowedTypes.join(",")} onChange={(event) => {
              const selected = event.target.files?.[0];
              const previousPreview = previewUrls.current[item.id];
              if (previousPreview) URL.revokeObjectURL(previousPreview);
              const nextPreview = selected ? URL.createObjectURL(selected) : undefined;
              previewUrls.current[item.id] = nextPreview;
              setPreviews((previous) => ({ ...previous, [item.id]: nextPreview }));
              setFiles((previous) => ({ ...previous, [item.id]: selected }));
              setError("");
              setNotice("");
            }} className="mt-2 block w-full text-[10px] text-gray-400 file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-black" />
          </label>
          <button disabled={!files[item.id] || saving !== null || loading} onClick={() => void saveImage(item.id)} className="mt-4 w-full rounded-full bg-[#E10600] py-2.5 text-xs font-bold disabled:opacity-40">
            {saving === item.id ? "Uploading…" : record ? "Save Image" : "Upload Image"}
          </button>
        </article>;
      })}
    </div>
  </section>;
}
