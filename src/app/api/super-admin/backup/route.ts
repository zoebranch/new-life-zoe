import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data:profile,error}=await db.from("profiles").select("role,is_suspended").eq("user_id",user.id).single();
 if(error||profile?.role!=="superadmin"||profile.is_suspended)return NextResponse.json({error:"Super Admin access required"},{status:403});
 const tables=["zones","cells","profiles","members","attendance_reports","evangelism_reports","member_join_requests","cell_creation_requests","site_content","site_images","site_settings","super_admin_activity","leader_invites","visitor_inquiries","zone_weekly_reports","church_care_requests", "ministry_join_requests"];
 try{const data:Record<string,unknown[]>={};for(const table of tables){const rows:unknown[]=[];for(let offset=0;;offset+=1000){const {data:page,error}=await db.from(table).select("*").order(table==="profiles"?"user_id":table==="leader_invites"?"email":table==="site_images"?"slot":table==="site_settings"?"id":"id").range(offset,offset+999);if(error)throw Error(table);rows.push(...page);if(page.length<1000)break;}data[table]=rows;}
 return new NextResponse(JSON.stringify({format:"zoe-church-app-data-v1",exportedAt:new Date().toISOString(),excludes:["Auth accounts and passwords","Storage file contents"],data},null,2),{headers:{"Content-Type":"application/json","Content-Disposition":"attachment; filename=zoe-church-backup.json","Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Export failed; no partial backup was returned."},{status:500,headers:{"Cache-Control":"no-store"}});}
}
