"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage, type SiteMediaKind } from "@/lib/site-media";
import SiteImageManager from "@/components/site-image-manager";
import SiteSettingsManager from "@/components/site-settings-manager";
import { SiteImage } from "@/components/site-image";

type ContentKind = SiteMediaKind;
type SiteContent = {
  id: string;
  kind: ContentKind;
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
  is_published: boolean;
  created_at: string;
};

type EditorForm = {
  title: string;
  description: string;
  themeMonth: string;
  eventDate: string;
  eventEndDate: string;
  recordingYear: string;
  location: string;
  isPublished: boolean;
};

const kindLabels: Record<ContentKind, string> = {
  theme: "Theme of the Month",
  event: "Upcoming Events",
  photo: "Photo Gallery",
  download: "Video & Sermon Downloads",
};
const photoTypes = "image/jpeg,image/png,image/webp,image/gif";
const downloadTypes = "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,application/pdf";

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function emptyForm(): EditorForm {
  const now = new Date();
  return {
    title: "", description: "", themeMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    eventDate: localDate(now), eventEndDate: "", recordingYear: String(now.getFullYear()), location: "", isPublished: false,
  };
}

export default function WebsiteContentManager() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [items, setItems] = useState<SiteContent[]>([]);
  const [kind, setKind] = useState<ContentKind>("theme");
  const [editing, setEditing] = useState<SiteContent | null>(null);
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshItems = useCallback(async () => {
    const { data, error: queryError } = await createClient().from("site_content")
      .select("id,kind,title,description,theme_month,event_date,event_end_date,recording_year,location,media_path,media_content_type,media_file_name,is_published,created_at")
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    setItems((data ?? []) as SiteContent[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/leaders"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("role").eq("user_id", user.id).maybeSingle();
      if (profileError || profile?.role !== "superadmin") { router.replace("/leaders"); return; }
      setAdminId(user.id);
      try {
        await refreshItems();
      } catch {
        if (active) setError("Website content could not be loaded. Apply the website content migration, then refresh.");
      } finally {
        if (active) { setLoading(false); setReady(true); }
      }
    }
    void initialize();
    return () => { active = false; };
  }, [refreshItems, router]);

  const visibleItems = useMemo(() => items.filter((item) => item.kind === kind), [items, kind]);

  function resetEditor() {
    setEditing(null);
    setForm(emptyForm());
    setFile(null);
    setError("");
    setNotice("");
  }

  function startEditing(item: SiteContent) {
    setEditing(item);
    setKind(item.kind);
    setForm({
      title: item.title, description: item.description,
      themeMonth: item.theme_month ?? emptyForm().themeMonth,
      eventDate: item.event_date ?? emptyForm().eventDate, eventEndDate: item.event_end_date ?? "", recordingYear: String(item.recording_year ?? new Date().getFullYear()),
      location: item.location, isPublished: item.is_published,
    });
    setFile(null);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateFile(selected: File, type: ContentKind) {
    if (type === "photo") return selected.type.startsWith("image/");
    if (type === "download") return selected.type.startsWith("video/") || selected.type.startsWith("audio/") || selected.type === "application/pdf";
    return selected.type.startsWith("image/");
  }

  async function saveContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminId) return;
    setSaving(true);
    setError("");
    setNotice("");
    let uploadedPath: string | null = null;
    let recordSaved = false;
    let fileCleanupWarning = false;
    try {
      if (file && !validateFile(file, kind)) {
        throw new Error(kind === "download" ? "Choose a video, audio, or PDF file." : "Choose an image file.");
      }
      if (kind === "event" && form.eventEndDate && form.eventEndDate < form.eventDate) throw new Error("The end date must be on or after the start date.");
      const needsMedia = kind === "photo" || kind === "download";
      if (needsMedia && !file && !editing?.media_path) throw new Error("Choose a file to upload.");

      const uploaded = file ? await siteMediaStorage.upload(file, kind) : null;
      uploadedPath = uploaded?.path ?? null;
      const content = {
        kind,
        title: form.title.trim(),
        description: form.description.trim(),
        theme_month: kind === "theme" ? form.themeMonth : null,
        event_date: kind === "event" ? form.eventDate : null,
        event_end_date: kind === "event" ? form.eventEndDate || null : null,
        recording_year: kind === "download" ? Number(form.recordingYear) : null,
        location: kind === "event" ? form.location.trim() : "",
        media_path: uploaded?.path ?? editing?.media_path ?? null,
        media_content_type: uploaded?.contentType ?? editing?.media_content_type ?? null,
        media_file_name: uploaded?.fileName ?? editing?.media_file_name ?? null,
        is_published: form.isPublished,
        updated_at: new Date().toISOString(),
      };

      const supabase = createClient();
      const result = editing
        ? await supabase.from("site_content").update(content).eq("id", editing.id).select("id").maybeSingle()
        : await supabase.from("site_content").insert({ ...content, created_by: adminId }).select("id").maybeSingle();
      if (result.error || !result.data) throw result.error ?? new Error("The content was not saved.");
      recordSaved = true;

      if (uploaded && editing?.media_path) {
        try { await siteMediaStorage.remove(editing.media_path); } catch { fileCleanupWarning = true; }
      }
      try { await refreshItems(); } catch { fileCleanupWarning = true; }
      setNotice(fileCleanupWarning
        ? "Content saved, but the list or an old file could not be refreshed. Use Refresh to check it."
        : form.isPublished ? "Published on the public website." : "Saved as a draft. It is not public yet.");
      setEditing(null);
      setForm(emptyForm());
      setFile(null);
    } catch (saveError) {
      if (uploadedPath && !recordSaved) {
        try { await siteMediaStorage.remove(uploadedPath); } catch { /* Keep the original save error visible. */ }
      }
      const message = saveError instanceof Error ? saveError.message : "We couldn't save this content. Try again.";
      setError(message.includes("site_content_one_theme_per_month")
        ? "A theme is already saved for that month. Edit the existing theme instead."
        : message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: SiteContent) {
    setError("");
    setNotice("");
    const { error: updateError } = await createClient().from("site_content")
      .update({ is_published: !item.is_published, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (updateError) { setError("We couldn't update this item. Refresh and try again."); return; }
    try { await refreshItems(); setNotice(item.is_published ? "Removed from the public website." : "Published on the public website."); }
    catch { setError("The item changed, but the list could not refresh."); }
  }

  async function deleteItem(item: SiteContent) {
    if (!window.confirm(`Delete “${item.title}”? This removes it from the public website.`)) return;
    setError("");
    setNotice("");
    const { error: deleteError } = await createClient().from("site_content").delete().eq("id", item.id);
    if (deleteError) { setError("We couldn't delete this item. Refresh and try again."); return; }
    let fileWarning = "";
    if (item.media_path) {
      try { await siteMediaStorage.remove(item.media_path); }
      catch { fileWarning = " The record was deleted, but its file could not be removed from storage."; }
    }
    try { await refreshItems(); setNotice(`Content deleted.${fileWarning}`); }
    catch { setError(`The content was deleted, but the list could not refresh.${fileWarning}`); }
    if (editing?.id === item.id) resetEditor();
  }

  if (!ready) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">Loading website updates…</div>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-5 pt-8 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="Zoe Branch" width={42} height={42} className="w-[42px] h-[42px] object-contain rounded-full bg-white" />
            <div><p className="font-black text-sm">Website Updates</p><p className="text-xs text-gray-400">Manage what visitors see, without editing code.</p></div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">View Website</Link>
            <Link href="/super-admin" className="rounded-full bg-[#E10600] px-4 py-2 text-xs font-bold">← Super Admin</Link>
          </div>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#151515] p-4 md:p-5 mb-6">
          <p className="text-sm font-bold">How publishing works</p>
          <p className="text-xs text-gray-400 mt-1">Save an item as a draft while preparing it. Turn on “Publish now” to show it on the public website. Uploaded files are stored separately from their website details.</p>
        </div>

        <SiteSettingsManager />
        <SiteImageManager />

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-green-900 bg-green-950/30 p-3 text-sm text-green-200">{notice}</p>}

        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Website content categories">
          {(Object.keys(kindLabels) as ContentKind[]).map((value) => (
            <button key={value} onClick={() => { setKind(value); resetEditor(); }} className={`rounded-full px-4 py-2.5 text-xs font-bold ${kind === value ? "bg-[#E10600]" : "bg-[#222] text-gray-300"}`}>
              {kindLabels[value]}
            </button>
          ))}
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-start">
          <form onSubmit={saveContent} className="rounded-[24px] border border-white/10 bg-[#151515] p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-black text-lg">{editing ? "Edit" : "Add"} {kindLabels[kind]}</h1>
              {editing && <button type="button" onClick={resetEditor} className="text-xs text-gray-400 underline">Cancel edit</button>}
            </div>

            <label className="block text-xs font-bold text-gray-300">Title
              <input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
            </label>
            <label className="block text-xs font-bold text-gray-300">{kind === "theme" ? "Scripture for the month" : "Description"}
              <textarea maxLength={3000} rows={4} placeholder={kind === "theme" ? "Enter the Bible reference and scripture text" : undefined} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
              {kind === "theme" && <span className="mt-2 block text-xs font-normal text-gray-400">Shown alongside this month’s theme on the homepage. Include the reference and verse in your preferred translation.</span>}
            </label>

            {kind === "theme" && <label className="block text-xs font-bold text-gray-300">Month
              <input required type="month" value={form.themeMonth.slice(0, 7)} onChange={(event) => setForm({ ...form, themeMonth: `${event.target.value}-01` })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
            </label>}
            {kind === "event" && <>
              <label className="block text-xs font-bold text-gray-300">Event date
                <input required type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-300">End date (optional)
                <input type="date" min={form.eventDate} value={form.eventEndDate} onChange={(event) => setForm({ ...form, eventEndDate: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
                <span className="mt-1 block text-[11px] font-normal text-gray-500">For events that span several days. Add start times and programme details in the description.</span>
              </label>
              <label className="block text-xs font-bold text-gray-300">Location
                <input maxLength={240} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
              </label>
            </>}
            {kind === "download" && <label className="block text-xs font-bold text-gray-300">Sermon/video year
              <input required type="number" min="1900" max="2100" value={form.recordingYear} onChange={(event) => setForm({ ...form, recordingYear: event.target.value })} className="mt-1 w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-sm text-white" />
              <span className="mt-1 block text-[11px] font-normal text-gray-500">Enter the year this was recorded so it appears in the right archive year.</span>
            </label>}

            {(kind === "event" || kind === "photo" || kind === "download") && <label className="block text-xs font-bold text-gray-300">{kind === "photo" ? "Photo file" : kind === "download" ? "Video, audio, or PDF file"  : "Event poster or image (optional)"}
              <input type="file" accept={kind === "download" ? downloadTypes : photoTypes} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-xl border border-[#333] bg-[#0a0a0a] p-3 text-xs text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-bold file:text-black" />
              {editing?.media_path && <span className="mt-1 block text-[11px] text-gray-500">Current file: {editing.media_file_name || "Uploaded media"}. Choose another file to replace it.</span>}
            </label>}

            <label className="flex items-center gap-3 rounded-xl bg-[#0a0a0a] p-3 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} className="h-4 w-4 accent-[#E10600]" />
              <span><b>Publish now</b><small className="block text-xs text-gray-500">Visible to everyone on the public website.</small></span>
            </label>

            <button disabled={saving || loading} className="w-full rounded-full bg-[#E10600] py-3 text-sm font-black disabled:opacity-50">
              {saving ? "Saving…" : editing ? "Save Changes" : form.isPublished ? "Publish" : "Save Draft"}
            </button>
          </form>

          <section className="rounded-[24px] border border-white/10 bg-[#151515] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h2 className="font-black">{kindLabels[kind]}</h2><p className="mt-1 text-xs text-gray-400">{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}</p></div>
              <button onClick={() => { setLoading(true); void refreshItems().catch(() => setError("Content list could not be refreshed." )).finally(() => setLoading(false)); }} className="rounded-full bg-[#222] px-4 py-2 text-xs font-bold">Refresh</button>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading saved items…</p> : visibleItems.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-gray-400">No {kindLabels[kind].toLowerCase()} yet. Add one using the form.</p> : (
              <div className="space-y-3 max-h-[850px] overflow-auto pr-1">
                {visibleItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm">{item.title}</h3>
                        <p className="mt-1 text-xs text-gray-400">{item.kind === "theme" ? item.theme_month?.slice(0, 7) : item.kind === "download" ? item.recording_year : (item.event_date ? `${item.event_date}${item.event_end_date ? ` – ${item.event_end_date}` : ""}` : new Date(item.created_at).toLocaleDateString())}{item.location ? ` · ${item.location}` : ""}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.is_published ? "bg-green-900/50 text-green-200" : "bg-yellow-900/40 text-yellow-200"}`}>{item.is_published ? "Published" : "Draft"}</span>
                    </div>
                    {item.description && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-400">{item.description}</p>}
                    {item.media_path && <a href={siteMediaStorage.publicUrl(item.media_path)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-blue-300 underline">Open {item.media_file_name || "attached file"}</a>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => startEditing(item)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">Edit</button>
                      <button onClick={() => void togglePublished(item)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">{item.is_published ? "Unpublish" : "Publish"}</button>
                      <button onClick={() => void deleteItem(item)} className="rounded-full bg-red-950/70 px-4 py-2 text-xs font-bold text-red-200">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}


