"use client";
import {useEffect,useRef,type ReactNode} from 'react';

export default function AdminMenuDrawer({onClose,children}:{onClose:()=>void;children:ReactNode}){
 const panel=useRef<HTMLElement>(null);
 const close=useRef(onClose);
 useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();return;}
   if(event.key!=='Tab')return;
   const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);previous?.focus();};
 },[]);
 return <div className="admin-drawer-overlay"><button className="admin-drawer-backdrop" onClick={onClose} aria-label="Close navigation" tabIndex={-1}/><aside id="admin-dashboard-menu" ref={panel} className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title"><div className="admin-drawer-heading"><div><p>ZOE BRANCH</p><h2 id="admin-drawer-title">Administration</h2><span>Super Admin workspace</span></div><button className="admin-drawer-close" onClick={onClose} aria-label="Close dashboard menu"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div className="admin-drawer-content">{children}</div><footer className="admin-drawer-footer"><form action="/api/auth/logout" method="post"><button type="submit">Sign out <span aria-hidden="true">↗</span></button></form></footer></aside></div>;
}
