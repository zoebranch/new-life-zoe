"use client";
import {useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {ministries} from "@/lib/ministries";
import {createClient} from "@/lib/supabase/client";
import {useSiteSettings} from "@/lib/use-site-settings";
import {SiteImage} from "@/components/site-image";
import "@/app/ministries.css";
export default function MinistryJoin(){
 const params=useParams();const ministry=ministries.find(m=>m.id===params.ministry);const settings=useSiteSettings();
 const [name,setName]=useState(""),[phone,setPhone]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!ministry||busy)return;setError("");if(!name.trim()||phone.trim().length<3){setError("Enter your name and a phone number we can use to contact you.");return;}setBusy(true);try{const {error}=await createClient().from("ministry_join_requests").insert({ministry:ministry.id,name:name.trim(),phone:phone.trim(),message:message.trim()});if(error)throw error;setDone(true);}catch{setError("Your request could not be sent. Please try again.");}finally{setBusy(false);}}
 return <main className="ministry-page"><header className="ministry-page-header"><Link href="/" className="ministry-brand"><SiteImage slot="church-logo" fallbackSrc="/logo.png" width={44} height={44} alt=""/><span>{settings.church_name}<small>{settings.branch_name}</small></span></Link><Link href="/#ministries">Back to ministries</Link></header><section className="ministry-form-panel">
 {!ministry?<><h1>Ministry not found</h1><Link href="/#ministries">Explore our ministries</Link></>:done?<div role="status"><span className="ministry-success" aria-hidden="true">✓</span><h1>Your request is received.</h1><p>Thank you for your interest in {ministry.name}. The church will contact you to discuss the next steps.</p><Link className="ministry-join" href="/#ministries">Back to the website <span aria-hidden="true">↗</span></Link></div>:<><p className="ministry-eyebrow">BELONG. GROW. SERVE.</p><h1>Join {ministry.name}.</h1><p>{ministry.description}</p><p className="ministry-form-help">No account is needed. Send your details so the church can help you connect.</p><form onSubmit={submit}><label htmlFor="ministry-name">Full name</label><input id="ministry-name" autoComplete="name" required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/><label htmlFor="ministry-phone">Phone number</label><input id="ministry-phone" type="tel" autoComplete="tel" required minLength={3} maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)}/><label htmlFor="ministry-message">Anything you’d like us to know <span>(optional)</span></label><textarea id="ministry-message" maxLength={1000} rows={4} value={message} onChange={e=>setMessage(e.target.value)}/><p className="ministry-form-help">Your details are shared privately with the church administrator for ministry follow-up.</p>{error&&<p role="alert" className="ministry-error">{error}</p>}<button className="ministry-join" disabled={busy}>{busy?"Sending…":"Send join request"}<span aria-hidden="true">↗</span></button></form></>}
 </section></main>;
}
