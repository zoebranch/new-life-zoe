import {createHmac,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {ministryAdmin} from '@/lib/ministry-whatsapp';
export const runtime='nodejs';
export async function GET(request:Request){const params=new URL(request.url).searchParams;const token=process.env.WHATSAPP_VERIFY_TOKEN;if(token&&params.get('hub.mode')==='subscribe'&&params.get('hub.verify_token')===token)return new Response(params.get('hub.challenge')||'');return new Response('Forbidden',{status:403});}
export async function POST(request:Request){
 const secret=process.env.WHATSAPP_APP_SECRET;if(!secret)return new Response('Not configured',{status:503});
 const raw=await request.text(),signature=request.headers.get('x-hub-signature-256')||'',expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 if(!/^sha256=[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return new Response('Forbidden',{status:403});
 try{const payload=JSON.parse(raw),db=ministryAdmin();for(const entry of payload.entry||[])for(const change of entry.changes||[])for(const status of change.value?.statuses||[]){
  if(typeof status.id!=='string'||!['sent','delivered','read','failed'].includes(status.status))continue;
  const state=status.status==='sent'?'accepted':status.status;
  const errorNote=state==='failed'?`Meta reported delivery failure (code ${Number(status.errors?.[0]?.code)||'unknown'}).`:'';
  const receipt=await db.from('ministry_whatsapp_receipts').upsert({message_id:status.id,state,error_note:errorNote},{onConflict:'message_id,state'});if(receipt.error)throw Error();
  const allowed=state==='accepted'?['accepted']:state==='delivered'?['accepted','delivered']:state==='read'?['accepted','delivered','read']:['accepted'];
  const{error}=await db.from('ministry_whatsapp_outbox').update({state,last_error:errorNote,updated_at:new Date().toISOString()}).eq('provider_message_id',status.id).in('state',allowed);if(error)throw Error();
 }return NextResponse.json({received:true});}catch{return new Response('Processing failed',{status:500});}
}
