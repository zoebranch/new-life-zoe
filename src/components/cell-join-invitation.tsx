"use client";
import {useRef,useState} from 'react';

export default function CellJoinInvitation({cellId,cellName}:{cellId:number;cellName:string}){
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 const link=`https://new-life-zoe.vercel.app/cells/${cellId}/join`;
 const message=`You’re invited to join ${cellName} at New Life Christian Center, Zoe Branch. Open this link to send your joining request directly to our cell leader: ${link}`;
 async function copy(){
  try{await navigator.clipboard.writeText(link);setNotice('Joining link copied. Paste it into a message to invite someone.');}
  catch{field.current?.focus();field.current?.select();setNotice('Select and copy the link above, then paste it into your message.');}
 }
 async function share(){
  if(busy)return;
  setBusy(true);setNotice('');
  try{if(navigator.share)await navigator.share({title:`Join ${cellName}`,text:`You’re invited to join ${cellName} at Zoe Branch. Send your request directly to the cell leader.`,url:link});else await copy();}
  catch(error){if(!(error instanceof Error&&error.name==='AbortError'))await copy();}
  finally{setBusy(false);}
 }
 return <section id="cell-invitation" className="cell-invitation" aria-labelledby="cell-invitation-title"><div className="cell-invitation-heading"><div><p className="cell-dashboard-eyebrow">GROW YOUR COMMUNITY</p><h2 id="cell-invitation-title">Invite someone to {cellName}</h2><p>Share this direct link. They can request to join your cell without searching the website or signing in.</p></div><span className="cell-invitation-mark" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/></svg></span></div><label htmlFor="cell-joining-link">Your cell’s joining link</label><div className="cell-invitation-link"><input ref={field} id="cell-joining-link" type="url" readOnly value={link} onFocus={event=>event.currentTarget.select()}/><button type="button" onClick={()=>void copy()}>Copy link</button></div><div className="cell-invitation-actions"><button type="button" disabled={busy} onClick={()=>void share()}>{busy?'Opening…':'Share invitation ↗'}</button><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp ↗</a><a href={link} target="_blank" rel="noopener noreferrer">View joining form</a></div><p className="cell-invitation-help">Requests arrive in your Join requests section for approval. The link stays the same, so you can reuse it.</p>{notice&&<p role="status" className="cell-invitation-notice">{notice}</p>}</section>;
}
