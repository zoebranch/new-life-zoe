"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSiteSettings } from "@/lib/use-site-settings";
import { SiteImage } from "@/components/site-image";
import { careKinds, memberCareKinds, localDateToday, type CareKind } from "@/lib/care-requests";
import "@/app/ministries.css";
import "@/app/visit/visit.css";

export default function CareRequestPage({ mode, initialKind = "prayer" }: { mode: "visit" | "appointment" | "care"; initialKind?: CareKind }) {
  const settings = useSiteSettings();
  const [kind, setKind] = useState<CareKind>(mode === "care" ? initialKind : mode);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  const scheduled = kind === "visit" || kind === "appointment";
  const notice = !scheduled && kind !== "prayer";
  const option = careKinds[kind];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();
    const name = value("name"), phone = value("phone"), email = value("email"), message = value("message");
    if (!name || (kind === "prayer" ? phone.replace(/\D/g, "").length < 7 : phone.length < 3 && !email)) { setError(kind === "prayer" ? "Enter your registered full name and phone number so we can identify your cell." : "Enter your name and at least one contact method."); return; }
    if (!scheduled && !message) { setError("Please add the details of your request."); return; }
    if (notice && !value("subject_name")) { setError("Enter the person, family, or subject this concern relates to."); return; }
    const date = value("date");
    if (scheduled && (!date || date < localDateToday())) { setError("Choose today or a future date."); return; }
    setBusy(true); setError("");
    try {
      // These rows are private requests, never public announcements.
      const payload = { kind, name, phone, email, message, requested_date: date || null,
        preferred_time: value("time"), guests: kind === "visit" ? Number(form.get("guests")) : 1,
        ...(notice ? { subject_name: value("subject_name"), announcement_requested: form.get("announcement_requested") === "on" } : {}),
      };
      const db = createClient();
      const { error: saveError } = kind === "prayer"
        ? await db.rpc("submit_cell_prayer_request", { p_name: name, p_phone: phone, p_message: message })
        : await db.from("church_care_requests").insert(payload);
      if (saveError) throw saveError;
      setDone(true);
    } catch { setError(kind === "prayer" ? "We could not submit your prayer request. Check your registered name and phone number, or contact your cell leader. If you recently submitted several requests, please try again later." : "Your request could not be saved. Please try again or contact the church directly."); }
    finally { setBusy(false); }
  }
  return <main className="ministry-page">
    <header className="ministry-page-header"><Link href="/" className="ministry-brand"><SiteImage slot="church-logo" fallbackSrc="/logo.png" width={44} height={44} alt=""/><span>{settings.church_name}<small>{settings.branch_name}</small></span></Link><Link href="/">Back to website</Link></header>
    <div className="visit-intro"><p className="ministry-eyebrow">{mode === "care" ? "CARING FOR OUR CHURCH FAMILY" : "YOU’RE WELCOME HERE"}</p><h1>{mode === "care" ? "Prayer & Church Care" : careKinds[mode].name}</h1><p>{mode === "care" ? "Ask for prayer, share family news, or let us know where support is needed." : careKinds[mode].intro}</p>
      {mode !== "care" && <nav className="visit-links" aria-label="Visits and appointments"><Link href="/visit" aria-current={mode === "visit" ? "page" : undefined}>Plan a visit</Link><Link href="/appointments" aria-current={mode === "appointment" ? "page" : undefined}>Meet the pastor</Link></nav>}
      {mode === "care" && <nav className="visit-options" aria-label="Choose a care request">{memberCareKinds.map(id => <button key={id} type="button" disabled={busy} aria-pressed={kind === id} onClick={() => { setKind(id); setDone(false); setError(""); }}>{careKinds[id].name}</button>)}</nav>}
    </div>
    <section className="ministry-form-panel visit-panel" key={kind} aria-label={option.name}>
      {done ? <div role="status"><span className="ministry-success" aria-hidden="true">✓</span><h2>Your request has been saved.</h2><p>{kind === "prayer" ? "Your prayer request is in your cell leader’s private inbox." : kind === "appointment" ? "The secretary will contact you after reviewing your request. Your requested date and time are not confirmed yet." : kind === "visit" ? "We look forward to welcoming you. The secretary can contact you about your visit." : "Your request is private and available to the church secretary and administrator. Nothing has been published. Any announcement will be discussed before it is shared."}</p><Link className="ministry-join" href="/">Back to website ↗</Link></div> : <>
        <h2>{option.name}</h2>{mode === "care" && <p>{option.intro}</p>}
        <form onSubmit={submit}>
          <label htmlFor="care-name">{kind === "prayer" ? "Registered full name" : notice ? "Your full name" : "Full name"}</label><input id="care-name" name="name" autoComplete="name" required maxLength={160}/>
          <div className="visit-contact"><div><label htmlFor="care-phone">{kind === "prayer" ? "Registered phone number" : "Phone number (optional)"}</label><input id="care-phone" name="phone" type="tel" autoComplete="tel" required={kind === "prayer"} maxLength={40}/></div>{kind !== "prayer" && <div><label htmlFor="care-email">Email <span>(optional)</span></label><input id="care-email" name="email" type="email" autoComplete="email" maxLength={254}/></div>}</div>
          {kind === "prayer" && <p className="ministry-form-help">Your name and phone are matched privately to the member register. If you are not registered yet, contact your cell leader first.</p>}
          {kind !== "prayer" && <p className="ministry-form-help">Provide at least one contact method so the church can follow up.</p>}
          {notice && <><label htmlFor="care-subject">{kind === "other" ? "Who or what does this concern?" : "Person or family concerned"}</label><input id="care-subject" name="subject_name" required maxLength={160}/></>}
          {scheduled && <><label htmlFor="care-date">{kind === "visit" ? "Planned visit date" : "Preferred appointment date"}</label><input id="care-date" name="date" type="date" required min={localDateToday()}/><label htmlFor="care-time">{kind === "visit" ? "Service or arrival time" : "Preferred time"} <span>(optional)</span></label><input id="care-time" name="time" maxLength={80} placeholder={kind === "visit" ? "e.g. First Sunday service" : "e.g. Afternoon"}/></>}
          {kind === "visit" && <><label htmlFor="care-guests">How many people are visiting?</label><input id="care-guests" name="guests" type="number" min={1} max={50} defaultValue={1} required/></>}
          <label htmlFor="care-message">{kind === "prayer" ? "Your prayer request" : scheduled ? "Anything we should know? (optional)" : "Details for the church care team"}</label><textarea id="care-message" name="message" rows={5} maxLength={2000} required={!scheduled}/>
          {notice && <><p className="ministry-form-help">Share only details you are authorized to give the church.{kind === "hospital" && " Medical diagnoses are not needed."}</p><label className="care-check"><input type="checkbox" name="announcement_requested"/><span>Please contact me about preparing a church announcement. This does not authorize publication.</span></label></>}
          <p className="ministry-form-help">{kind === "prayer" ? "No account is needed. Your prayer request goes to your cell leader, not the secretary or public website." : "No account is needed. Your details go to the secretary’s private request inbox, not the public website."}</p>
          {error && <p role="alert" className="ministry-error">{error}</p>}
          <button disabled={busy} className="ministry-join">{busy ? "Saving…" : scheduled ? kind === "visit" ? "Send visit details" : "Request appointment" : "Send private request"} <span aria-hidden="true">↗</span></button>
        </form>
      </>}
    </section>
    {mode === "visit" && <aside className="visit-services"><h2>Gather with us</h2>{settings.service_times.map((service, i) => <p key={i}><strong>{service.title}</strong><br/>{service.day} · {service.time}</p>)}{settings.contact_address && <p>{settings.contact_address}</p>}</aside>}
  </main>;
}
