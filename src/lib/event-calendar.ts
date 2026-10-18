type CalendarEvent={id:string;title:string;description:string;location:string;event_date:string|null;event_end_date:string|null};
const escapeText=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string){const parts:string[]=[];let part='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>75){parts.push(part);part=' ';bytes=1;}part+=char;bytes+=size;}parts.push(part);return parts.join('\r\n');}
export function eventCalendar(event:CalendarEvent){
 if(!event.event_date||!/^\d{4}-\d{2}-\d{2}$/.test(event.event_date))return null;
 const endDate=event.event_end_date||event.event_date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<event.event_date)return null;
 const end=new Date(`${endDate}T00:00:00Z`);if(!Number.isFinite(end.getTime())||end.toISOString().slice(0,10)!==endDate)return null;
 const start=new Date(`${event.event_date}T00:00:00Z`);if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==event.event_date)return null;
 end.setUTCDate(end.getUTCDate()+1);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zoe Branch//Church Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escapeText(event.id)}@new-life-zoe.vercel.app`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${event.event_date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replace(/-/g,'')}`,`SUMMARY:${escapeText(event.title)}`,`DESCRIPTION:${escapeText(event.description)}`,`LOCATION:${escapeText(event.location)}`,'URL:https://new-life-zoe.vercel.app/#upcoming-events','END:VEVENT','END:VCALENDAR',''].map(fold).join('\r\n');
}
