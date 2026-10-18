"use client";
import type {Cell} from '@/data/cells';
import {normalizeWhatsAppPhone} from '@/lib/ministry-routing';
import '@/app/zone-operations.css';
export default function ZoneLeaderContacts({cells}:{cells:Cell[]}){
 return <details className="zone-ops-panel"><summary className="zone-contacts-summary">Cell leader contacts <span>{cells.length} cells</span></summary><p className="zone-ops-meta">Call a leader or open a prepared WhatsApp message. You send the message yourself.</p><div className="zone-contacts-grid">{cells.map(c=>{const phone=normalizeWhatsAppPhone(c.phone);return <article className="zone-task-card" key={c.id}><h3>{c.name}</h3><p>{c.leader||'Leader not recorded'}</p><p className="zone-ops-meta">{c.area} · {c.phone||'Phone not recorded'}</p><div className="zone-ops-actions">{c.phone&&<a href={`tel:${c.phone.replace(/[^+\d]/g,'')}`}>Call leader</a>}{phone&&<a href={`https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent(`Hello ${c.leader||'Leader'}, I’m following up with you about ${c.name}.`)}`} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}</div></article>;})}</div></details>;
}
