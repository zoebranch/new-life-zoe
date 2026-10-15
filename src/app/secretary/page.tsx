import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import SecretaryWorkspace from "@/components/secretary-workspace";
export default async function SecretaryPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/leaders");
 const {data:profile,error}=await db.from("profiles").select("role,is_suspended,display_name").eq("user_id",user.id).single();
 if(error||profile.is_suspended||!["secretary","superadmin"].includes(profile.role))redirect("/leaders");
 return <SecretaryWorkspace name={profile.display_name||"Secretary"}/>;
}
