"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {fetchAllRows} from '@/lib/fetch-all-rows';
import {useDashboardRefresh} from '@/lib/use-dashboard-refresh';
import {localDateToday} from '@/lib/care-requests';
import WeeklyBulletinPreview,{type Bulletin} from '@/components/weekly-bulletin-preview';
function eventDates(start:string,end:string|null){
 const format=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Lusaka'});
 return start?format(start)+(end&&end!==start?' – '+format(end):''):'';
}
export default function PublicWeeklyBulletin(){
 const refresh=useDashboardRefresh();
 const[content,setContent]=useState<Bulletin|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{try{const db=createClient();const[weekly,announcements,events]=await Promise.all([db.rpc('get_public_weekly_bulletin'),db.rpc('list_public_church_announcements'),fetchAllRows((a,b)=>db.from('site_content').select('id,title,description,event_date,event_end_date,location').eq('kind','event').eq('is_published',true).order('event_date').order('id').range(a,b))]);if(weekly.error||announcements.error||events.error)throw Error();const today=localDateToday(),date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-date.getUTCDay());const row=weekly.data?.[0];const notices:Bulletin['notices']=(announcements.data??[]).map((item:{title:string;body:string})=>({tag:'CHURCH FAMILY',title:item.title,body:item.body,href:'/#announcements',action:'Church announcements'}));for(const item of (events.data??[]).filter(item=>(item.event_end_date??item.event_date)>=today).slice(0,3))notices.push({tag:'UPCOMING GATHERING',title:item.title,body:[eventDates(item.event_date,item.event_end_date),item.location,item.description].filter(Boolean).join(' · '),href:'/#upcoming-events',action:'View event details'});if(active){setContent({date:row?.week_start??date.toISOString().slice(0,10),title:row?.title??'This week at Zoe.',intro:row?.intro??'Our next weekly encouragement is being prepared. Stay connected with church notices, upcoming gatherings, and service times below.',scripture:row?.scripture??'',reference:row?.reference??'',notices});setError(false);}}catch{if(active)setError(true);}})();return()=>{active=false;};},[revision,refresh]);
 if(error)return <main className="bulletin-load"><h1>The bulletin is temporarily unavailable.</h1><p>Please try again in a moment.</p><button onClick={()=>{setError(false);setRevision(v=>v+1);}}>Try again</button><Link href="/">Back to website</Link></main>;
 if(!content)return <main className="bulletin-load" role="status">Loading this week at Zoe…</main>;
 return <WeeklyBulletinPreview key={JSON.stringify(content)} content={content} publicView/>;
}
