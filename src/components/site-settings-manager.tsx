"use client";

import { useEffect, useState, type FormEvent } from "react";
import { siteMediaStorage } from "@/lib/site-media";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SITE_SETTINGS, mergeSiteSettings, type ServiceTime, type SiteSettings } from "@/lib/site-settings";

export default function SiteSettingsManager() {
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [photoFiles,setPhotoFiles] = useState<Partial<Record<"collage_upload_2" | "collage_upload_3",File>>>({});
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [gallery, setGallery] = useState<Array<{id:string;title:string}>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      const {data: photos} = await createClient().from("site_content").select("id,title").eq("kind","photo").eq("is_published",true).not("media_path","is",null).order("display_order");
      if(active) setGallery(photos ?? []);
      const { data, error: loadError } = await createClient().from("site_settings").select("*").eq("id", true).maybeSingle();
      if (!active) return;
      if (loadError) {
        setError("Church details could not be loaded. Apply the church details migration, then refresh.");
      } else if (data) {
        setForm(mergeSiteSettings(data as Partial<SiteSettings>));
      }
      setLoading(false);
    }
    void loadSettings();
    return () => { active = false; };
  }, []);

  function updateField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateService(index: number, key: keyof ServiceTime, value: string) {
    setForm((current) => ({
      ...current,
      service_times: current.service_times.map((service, serviceIndex) => serviceIndex === index ? { ...service, [key]: value } : service),
    }));
  }

  async function chooseVideo(file: File | undefined) {
    setVideoFile(null); setError("");
    if (!file) return;
    if (!["video/mp4","video/webm"].includes(file.type) || file.size > 40 * 1024 * 1024) {
      setError("Choose an MP4 or WebM video up to 40 MB and 40 seconds."); return;
    }
    setCheckingVideo(true);
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve,reject)=>{
        const video=document.createElement("video"); video.preload="metadata";
        const timeout=setTimeout(()=>{video.removeAttribute("src");video.load();reject(new Error("Video could not be read."));},15000);
        video.onloadedmetadata=()=>{clearTimeout(timeout);resolve(video.duration);video.removeAttribute("src");video.load();};
        video.onerror=()=>{clearTimeout(timeout);reject(new Error("Video could not be read."));}; video.src=url;
      });
      if (!Number.isFinite(duration) || duration<=0 || duration>40.5) throw new Error("Choose a video no longer than 40 seconds.");
      setVideoFile(file);
    } catch (cause) {setError(cause instanceof Error?cause.message:"Video could not be read.");}
    finally {URL.revokeObjectURL(url);setCheckingVideo(false);}
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const uploadedPaths: string[] = [];
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in as a Super Admin to update church details.");
      let nextCopy = form.homepage_copy;
      if (videoFile) {
        const uploaded = await siteMediaStorage.upload(videoFile,"download");
        uploadedPaths.push(uploaded.path);
        nextCopy = {...nextCopy,collage_video_path:uploaded.path,collage_video_name:videoFile.name};
      }
      for (const key of ["collage_upload_2","collage_upload_3"] as const) {
        const file=photoFiles[key];
        if(file) {
          if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type) || file.size>12*1024*1024) throw new Error("Photos must be JPG, PNG, WebP or GIF, up to 12 MB.");
          const uploaded=await siteMediaStorage.upload(file,"photo");
          uploadedPaths.push(uploaded.path); nextCopy={...nextCopy,[key]:uploaded.path};
        }
      }
      const payload = { ...form, homepage_copy:nextCopy, updated_by: user.id, updated_at: new Date().toISOString() };
      const { error: saveError } = await supabase.from("site_settings").upsert(payload, { onConflict: "id" });
      if (saveError) throw saveError;
      uploadedPaths.length = 0;
      setPhotoFiles({});
      setForm(current=>({...current,homepage_copy:nextCopy}));
      setVideoFile(null);
      setNotice("Church details saved. The public homepage will show the updated information.");
    } catch {
      for(const path of uploadedPaths) {try {await siteMediaStorage.remove(path);} catch {/* Preserve save error. */}}
      setError("Church details could not be saved. Confirm the latest Supabase migration has been applied, then try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white";
  const labelClass = "block text-xs font-bold text-gray-300";

  return (
    <section className="mb-6 rounded-[24px] border border-white/10 bg-[#151515] p-5 md:p-6">
      <div className="mb-5">
        <h2 className="font-black text-lg">Church Details</h2>
        <p className="mt-1 text-xs text-gray-400">Update the names, message, service schedule, and contact information shown on the public website.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-green-900 bg-green-950/30 p-3 text-sm text-green-200">{notice}</p>}

      <form onSubmit={save} className="space-y-5">
        <details className="rounded-xl border border-white/15 p-4">
          <summary className="cursor-pointer text-sm font-bold">Homepage headings, messages & buttons</summary>
          <p className="mt-3 text-xs text-gray-400">Edit the public wording below. Button destinations stay connected to the correct pages.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{Object.entries(form.homepage_copy).filter(([key])=>!key.startsWith("collage_") && key!=="ribbon_motion").map(([key,value])=><label key={key} className={labelClass}>{key.replace(/_/g," ").replace(/^./,letter=>letter.toUpperCase())}<textarea required maxLength={key.endsWith("intro")?600:160} rows={key.endsWith("intro")?3:2} value={value} onChange={event=>updateField("homepage_copy",{...form.homepage_copy,[key]:event.target.value})} className={inputClass}/></label>)}</div>
        </details>
        <details className="rounded-xl border border-white/15 p-4">
          <summary className="cursor-pointer text-sm font-bold">Welcome photo collage & movement</summary>
          <p className="mt-3 text-xs text-gray-400">The left shape can play a short video. Upload and publish photos in Photo Gallery below for the other shapes. Automatic uses the gallery order; an empty gallery uses the homepage hero.</p>
          <div className="mt-4 rounded-xl border border-white/15 p-4">
            <h3 className="text-sm font-bold">Left shape — welcome video</h3>
            <p className="mt-2 text-xs text-gray-400">MP4 or WebM · up to 40 seconds · 40 MB maximum. Plays muted on a loop. A portrait video with its subject near the centre works best in the diagonal shape. Choose a file, then Save Church Details.</p>
            {form.homepage_copy.collage_video_path && <video controls playsInline preload="metadata" src={siteMediaStorage.publicUrl(form.homepage_copy.collage_video_path)} className="mt-3 max-h-48 w-full"/>}
            <label className={labelClass}>Choose welcome video<input disabled={checkingVideo || saving} type="file" accept="video/mp4,video/webm" onChange={event=>void chooseVideo(event.target.files?.[0])} className="mt-3 block w-full text-xs"/></label>
            {checkingVideo && <p role="status" className="mt-2 text-xs">Checking video duration…</p>}
            {videoFile && <p className="mt-2 text-xs text-green-200">Ready to save: {videoFile.name}</p>}
            {form.homepage_copy.collage_video_name && <p className="mt-2 text-xs text-gray-400">Saved video: {form.homepage_copy.collage_video_name}</p>}
            {form.homepage_copy.collage_video_path && <button type="button" onClick={()=>{setVideoFile(null);updateField("homepage_copy",{...form.homepage_copy,collage_video_path:"",collage_video_name:""});}} className="mt-3 text-xs text-red-300">Use photo instead (save to apply)</button>}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["collage_upload_2","collage_upload_3"] as const).map((key,index)=><div key={key} className="rounded-xl border border-white/15 p-4">
              <h3 className="text-sm font-bold">{index===0?"Middle bouncing shape — photo":"Right bouncing shape — photo"}</h3>
              <p className="mt-2 text-xs text-gray-400">Upload directly here, then Save Church Details. JPG, PNG, WebP or GIF · up to 12 MB.</p>
              {form.homepage_copy[key] && <a href={siteMediaStorage.publicUrl(form.homepage_copy[key])} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">View saved photo</a>}
              <label className={`${labelClass} mt-3`}>{index===0?"Choose middle shape photo":"Choose right shape photo"}<input type="file" disabled={saving || loading} accept="image/jpeg,image/png,image/webp,image/gif" onChange={event=>{const file=event.target.files?.[0];setError("");if(file && (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||file.size>12*1024*1024)){setError("Photos must be JPG, PNG, WebP or GIF, up to 12 MB.");setPhotoFiles(current=>({...current,[key]:undefined}));return;}setPhotoFiles(current=>({...current,[key]:file}));}} className="mt-2 block w-full text-xs"/></label>
              {photoFiles[key] && <p className="mt-2 text-xs text-green-200">Ready to save: {photoFiles[key]?.name}</p>}
              {form.homepage_copy[key] && <button type="button" onClick={()=>{setPhotoFiles(current=>({...current,[key]:undefined}));updateField("homepage_copy",{...form.homepage_copy,[key]:""});}} className="mt-3 text-xs text-red-300">Use gallery photo instead (save to apply)</button>}
            </div>)}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["collage_photo_1","collage_photo_2","collage_photo_3"] as const).map((key,index)=><label key={key} className={labelClass}>Photo {index+1} — {index===2?"small rounded shape":"diagonal capsule"}<select value={form.homepage_copy[key]} onChange={event=>updateField("homepage_copy",{...form.homepage_copy,[key]:event.target.value})} className={inputClass}><option value="">Automatic gallery photo</option>{gallery.map(photo=><option key={photo.id} value={photo.id}>{photo.title}</option>)}</select></label>)}
            <label className={labelClass}>Photo movement<select value={form.homepage_copy.collage_motion} onChange={event=>updateField("homepage_copy",{...form.homepage_copy,collage_motion:event.target.value})} className={inputClass}><option value="gentle">Gentle bounce</option><option value="still">Still photos</option></select></label>
            <label className={labelClass}>Welcome strip movement<select value={form.homepage_copy.ribbon_motion} onChange={event=>updateField("homepage_copy",{...form.homepage_copy,ribbon_motion:event.target.value})} className={inputClass}><option value="moving">Scroll left</option><option value="still">Still text</option></select></label>
          </div>
        </details>
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">Church identity</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>Church name<input required maxLength={160} value={form.church_name} onChange={(event) => updateField("church_name", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Branch name<input required maxLength={120} value={form.branch_name} onChange={(event) => updateField("branch_name", event.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Slogan or motto<textarea maxLength={500} rows={2} value={form.slogan} onChange={(event) => updateField("slogan", event.target.value)} className={inputClass} /></label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">Homepage welcome message</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>Small welcome heading<input maxLength={120} value={form.hero_eyebrow} onChange={(event) => updateField("hero_eyebrow", event.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Headline first line<input maxLength={120} value={form.hero_heading_start} onChange={(event) => updateField("hero_heading_start", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Highlighted words<input maxLength={120} value={form.hero_heading_highlight} onChange={(event) => updateField("hero_heading_highlight", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Words after highlight<input maxLength={120} value={form.hero_heading_end} onChange={(event) => updateField("hero_heading_end", event.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Supporting message or scripture<textarea maxLength={500} rows={2} value={form.hero_scripture} onChange={(event) => updateField("hero_scripture", event.target.value)} className={inputClass} /></label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">Theme of the year</h3>
          <p className="mb-3 text-xs text-gray-400">Shown directly below the welcome heading on the homepage. Leave the theme blank to hide it. Only the theme for the current year is displayed.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>Year<input required type="number" min={2000} max={2100} value={form.annual_theme_year} onChange={event=>updateField("annual_theme_year",Number(event.target.value))} className={inputClass}/></label>
            <label className={labelClass}>Annual theme<input maxLength={160} value={form.annual_theme} onChange={event=>updateField("annual_theme",event.target.value)} className={inputClass}/></label>
            <label className={`${labelClass} md:col-span-2`}>Annual theme scripture or supporting message<textarea maxLength={500} rows={2} value={form.annual_theme_scripture} onChange={event=>updateField("annual_theme_scripture",event.target.value)} className={inputClass}/></label>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Service times</h3><p className="mt-1 text-[11px] text-gray-500">Add, remove, or edit the services shown on the homepage.</p></div>
            <button type="button" disabled={form.service_times.length >= 12} onClick={() => updateField("service_times", [...form.service_times, { eyebrow: "NEW SERVICE", title: "", day: "", time: "" }])} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold disabled:opacity-50">+ Add service</button>
          </div>
          <div className="space-y-3">
            {form.service_times.map((service, index) => <div key={index} className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold text-gray-400">Service {index + 1}</p><button type="button" onClick={() => updateField("service_times", form.service_times.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-red-300">Remove</button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Category<input required maxLength={100} value={service.eyebrow} onChange={(event) => updateService(index, "eyebrow", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Service name<input required maxLength={120} value={service.title} onChange={(event) => updateService(index, "title", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Day<input required maxLength={100} value={service.day} onChange={(event) => updateService(index, "day", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Time<input required maxLength={100} value={service.time} onChange={(event) => updateService(index, "time", event.target.value)} className={inputClass} /></label>
              </div>
            </div>)}
            {form.service_times.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-500">No service times added. Use “Add service” to add one.</p>}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">Contact details</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>Phone number<input type="tel" maxLength={60} value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Email address<input type="email" maxLength={254} value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Address or location<textarea maxLength={300} rows={2} value={form.contact_address} onChange={(event) => updateField("contact_address", event.target.value)} className={inputClass} /></label>
          </div>
        </div>

        <button disabled={saving || loading || checkingVideo} className="w-full rounded-full bg-[#E10600] py-3 text-sm font-black disabled:opacity-50">{saving ? "Saving…" : "Save Church Details"}</button>
        {loading && <p className="text-center text-xs text-gray-500">Loading saved details…</p>}
      </form>
    </section>
  );
}
