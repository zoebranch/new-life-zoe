"use client";
import {eventCalendar} from '@/lib/event-calendar';
type Event={id:string;title:string;description:string;location:string;event_date:string|null;event_end_date:string|null};
export default function EventCalendarLink({event}:{event:Event}){
 function download(){const content=eventCalendar(event);if(!content)return;const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`zoe-event-${event.event_date}.ics`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <button type="button" className="home-event-calendar" onClick={download} aria-label={`Add ${event.title} to your calendar`}>Add to calendar <span aria-hidden="true">↗</span></button>;
}
