import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function ministryAdmin(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Server database setup incomplete');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function sendMinistryInvitation(requestId:string){
 const db=ministryAdmin();
 const{data:job,error}=await db.from('ministry_whatsapp_outbox').select('id,group_id,state').eq('request_id',requestId).maybeSingle();
 if(error)throw Error('Invitation queue unavailable');if(!job)return {state:'manual_review',note:'No invitation queued. Check age routing and WhatsApp consent.'};
 if(!['awaiting_setup','queued','failed'].includes(job.state))return {state:job.state,note:'This invitation is already being processed or requires delivery review.'};
 const token=process.env.WHATSAPP_ACCESS_TOKEN,phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID,template=process.env.WHATSAPP_INVITE_TEMPLATE,version=process.env.WHATSAPP_GRAPH_API_VERSION,appSecret=process.env.WHATSAPP_APP_SECRET;
 if(process.env.WHATSAPP_ENABLED!=='true'||!token||!phoneId||!template||!version||!appSecret||!process.env.WHATSAPP_VERIFY_TOKEN)return {state:'awaiting_setup',note:'Approval saved. Automatic WhatsApp delivery is waiting for Meta setup.'};
 if(!/^v\d+\.\d+$/.test(version)||!/^\d+$/.test(phoneId))throw Error('WhatsApp configuration is invalid');
 const[person,group]=await Promise.all([db.from('ministry_join_requests').select('name,phone,status,whatsapp_consent').eq('id',requestId).single(),db.from('ministry_whatsapp_groups').select('name,invite_url').eq('id',job.group_id).single()]);
 if(person.error||group.error)throw Error('Invitation details unavailable');
 if(person.data.status!=='approved'||!person.data.whatsapp_consent)return {state:'manual_review',note:'The request must be approved with WhatsApp consent.'};
 if(!group.data.invite_url)return {state:'awaiting_group',note:'Approval saved. Add this ministry’s group invite link before delivery.'};
 const claimed=await db.from('ministry_whatsapp_outbox').update({state:'sending',last_error:'',updated_at:new Date().toISOString()}).eq('id',job.id).in('state',['awaiting_setup','queued','failed']).select('id').maybeSingle();
 if(claimed.error)throw Error('Invitation could not be reserved');if(!claimed.data)return {state:'sending',note:'Another delivery attempt is already handling this invitation.'};
 try{
  const response=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:person.data.phone.replace('+',''),type:'template',template:{name:template,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:person.data.name},{type:'text',text:group.data.name},{type:'text',text:group.data.invite_url}]}]}}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok){const uncertain=response.status>=500;await db.from('ministry_whatsapp_outbox').update({state:uncertain?'unknown':'failed',last_error:uncertain?'Provider response uncertain. Check Meta before attempting another send.':`Meta rejected the request (code ${Number(result.error?.code)||response.status}).`,updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','sending');return {state:uncertain?'unknown':'failed',note:uncertain?'Delivery is uncertain. Check Meta before retrying.':'Meta did not accept the invitation. Check sender and template setup.'};}
  const messageId=result.messages?.[0]?.id;if(typeof messageId!=='string')throw Error('Missing message identifier');
  const saved=await db.from('ministry_whatsapp_outbox').update({state:'accepted',provider_message_id:messageId,updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','sending');
  if(saved.error)throw Error('Message receipt could not be stored');
  const receipts=await db.from('ministry_whatsapp_receipts').select('state,error_note').eq('message_id',messageId);
  const receipt=['read','delivered','failed'].map(state=>receipts.data?.find(r=>r.state===state)).find(Boolean);
  if(receipt)await db.from('ministry_whatsapp_outbox').update({state:receipt.state,last_error:receipt.error_note,updated_at:new Date().toISOString()}).eq('id',job.id).in('state',['accepted','failed']);
  return {state:'accepted',note:'Meta accepted the invitation. Delivery confirmation is pending.'};
 }catch{await db.from('ministry_whatsapp_outbox').update({state:'unknown',last_error:'Delivery could not be confirmed. Check Meta before resending.',updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','sending');return {state:'unknown',note:'Delivery could not be confirmed. Do not resend until checked in Meta.'};}
}
