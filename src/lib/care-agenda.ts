export type AgendaRequest={id:string;name:string;kind:string;status:string;requested_date:string|null;confirmed_date:string|null;confirmed_time:string|null};
export type AgendaFollowup={id:string;request_id:string;stage:string;next_followup:string|null;created_at:string};
export type AgendaEntry={id:string;name:string;date:string;label:string;overdue:boolean;time:string};
export function careAgenda(requests:AgendaRequest[],followups:AgendaFollowup[],today:string){
 const last=new Map<string,AgendaFollowup>();
 for(const row of followups){const previous=last.get(row.request_id);if(!previous||row.created_at>previous.created_at||(row.created_at===previous.created_at&&row.id>previous.id))last.set(row.request_id,row);}
 const end=new Date(`${today}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+7);const until=end.toISOString().slice(0,10);
 const entries:AgendaEntry[]=[];
 for(const row of requests){
  if(row.kind==='prayer'||row.status==='closed'||row.status==='rejected')continue;
  if(row.kind==='appointment'&&row.status==='approved'&&row.confirmed_date&&row.confirmed_date>=today&&row.confirmed_date<=until)entries.push({id:row.id,name:row.name,date:row.confirmed_date,label:'Confirmed pastor appointment',overdue:false,time:row.confirmed_time?.slice(0,5)||''});
  if(row.kind==='visit'&&row.requested_date&&row.requested_date>=today&&row.requested_date<=until)entries.push({id:row.id,name:row.name,date:row.requested_date,label:'Planned church visit',overdue:false,time:''});
  const followup=last.get(row.id);
  if(followup?.next_followup&&followup.stage!=='completed'&&followup.next_followup<=until)entries.push({id:row.id,name:row.name,date:followup.next_followup,label:'Care follow-up',overdue:followup.next_followup<today,time:''});
 }
 return entries.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.name.localeCompare(b.name));
}
