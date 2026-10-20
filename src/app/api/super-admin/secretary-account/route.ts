import {NextResponse} from "next/server";
import {createClient as createAdmin} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/server";
import {makeTemporaryPassword} from "@/lib/leader-credentials";
export const runtime="nodejs";
export async function POST(request:Request){
 const db=await createClient();const{data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const{data:profile,error:profileError}=await db.from("profiles").select("role,is_suspended").eq("user_id",user.id).single();
 if(profileError||profile?.role!=="superadmin"||profile.is_suspended)return NextResponse.json({error:"Super Admin access required"},{status:403});
 let action:string;try{const payload=await request.json();action=payload.action;}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!["create","reset","suspend","activate"].includes(action))return NextResponse.json({error:"Choose a valid account action"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Server setup incomplete"},{status:503});
 const admin=createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),email="newlifezoe2@gmail.com",name="Theresa Njoope";
 const{data:existing,error:existingError}=await admin.from("profiles").select("user_id,role,is_suspended").eq("username",email).maybeSingle();
 if(existingError)return NextResponse.json({error:"Account details could not be read"},{status:500});
 if(existing&&existing.role!=="secretary")return NextResponse.json({error:"This email already belongs to another role. Use a separate secretary email."},{status:409});
 if(action==="create"&&existing)return NextResponse.json({error:"The secretary account already exists. Reset its password if needed."},{status:409});
 if(action!=="create"&&!existing)return NextResponse.json({error:"Create the secretary account first"},{status:404});
 const password=makeTemporaryPassword();let createdId:string|null=null;
 try{
  if(action==="create"){
   const invite=await admin.from("leader_invites").insert({email,role:"secretary",cell_id:null,zone_id:null,created_by:user.id});if(invite.error)throw invite.error;
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});if(created.error||!created.data.user)throw created.error??Error();createdId=created.data.user.id;
   const check=await admin.from("profiles").select("role").eq("user_id",createdId).single();if(check.error||check.data.role!=="secretary")throw Error();
  }else if(action==="reset"){
   const result=await admin.auth.admin.updateUserById(existing!.user_id,{password});if(result.error)throw result.error;
  }else{
   const suspended=action==="suspend";const result=await admin.from("profiles").update({is_suspended:suspended}).eq("user_id",existing!.user_id).eq("role","secretary").select("user_id").single();if(result.error)throw result.error;
  }
  return NextResponse.json({success:true,email,...(["create","reset"].includes(action)?{password}:{})},{headers:{"Cache-Control":"no-store"}});
 }catch{
  if(action==="create"){if(createdId)await admin.auth.admin.deleteUser(createdId);await admin.from("leader_invites").delete().eq("email",email).eq("role","secretary");}
  return NextResponse.json({error:"The account action failed. Check whether this email already has a Supabase account."},{status:400,headers:{"Cache-Control":"no-store"}});
 }
}
