import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {sendMinistryInvitation} from '@/lib/ministry-whatsapp';
export const runtime='nodejs';
export async function GET(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const{data:profile}=await db.from('profiles').select('role,is_suspended').eq('user_id',user.id).single();if(profile?.role!=='superadmin'||profile.is_suspended)return NextResponse.json({error:'Super Admin access required'},{status:403});
 return NextResponse.json({configured:process.env.WHATSAPP_ENABLED==='true'&&['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_INVITE_TEMPLATE','WHATSAPP_GRAPH_API_VERSION','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN'].every(key=>!!process.env[key])},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const{data:profile,error}=await db.from('profiles').select('role,is_suspended').eq('user_id',user.id).single();
 if(error||profile?.role!=='superadmin'||profile.is_suspended)return NextResponse.json({error:'Super Admin access required'},{status:403});
 let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)||!['pending','contacted','closed','approved','rejected','retry'].includes(body.status))return NextResponse.json({error:'Choose a valid review action'},{status:400});
 try{
  if(body.status!=='retry'){const{error:reviewError}=await db.rpc('review_ministry_request',{p_id:body.id,p_status:body.status,p_notes:typeof body.notes==='string'?body.notes:''});if(reviewError)return NextResponse.json({error:'The review could not be saved. Refresh and check the request status.'},{status:409});}
  if(body.status==='approved'||body.status==='retry'){try{return NextResponse.json(await sendMinistryInvitation(body.id),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({state:'awaiting_setup',note:'Approval is saved. Delivery could not be checked; refresh the invitation status.'});}}
  return NextResponse.json({note:'Review saved.'});
 }catch{return NextResponse.json({error:'The request could not be processed.'},{status:500});}
}
