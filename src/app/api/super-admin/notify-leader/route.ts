import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {notifyLeaderAssignment} from "@/lib/leader-notification";

export async function POST(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data:admin,error}=await db.from("profiles").select("role,is_suspended").eq("user_id",user.id).single();
 if(error||admin?.role!=="superadmin"||admin.is_suspended)return NextResponse.json({error:"Administrator access required."},{status:403});
 let userId:unknown;try{userId=(await request.json()).userId;}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 if(typeof userId!=="string"||!/^[0-9a-f-]{36}$/i.test(userId))return NextResponse.json({error:"Choose a leader account."},{status:400});
 const {data:leader,error:leaderError}=await db.from("profiles").select("user_id,username,display_name,role,cell_id,zone_id,is_suspended").eq("user_id",userId).single();
 if(leaderError||!leader||leader.is_suspended||!["cell_leader","zone_leader"].includes(leader.role))return NextResponse.json({error:"Choose an active leader account."},{status:400});
 const kind=leader.role==="cell_leader"?"cell":"zone";
 const {data:unit,error:unitError}=await db.from(kind==="cell"?"cells":"zones").select("name,is_active").eq("id",kind==="cell"?leader.cell_id:leader.zone_id).single();
 if(unitError||!unit?.is_active)return NextResponse.json({error:"The assigned cell or zone is unavailable."},{status:400});
 const notification=await notifyLeaderAssignment({userId:leader.user_id,email:leader.username,leader:leader.display_name,kind,name:unit.name.toUpperCase()});
 return NextResponse.json({notification},{status:notification.status==="accepted"?200:503});
}
