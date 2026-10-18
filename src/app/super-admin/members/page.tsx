import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import ChurchMembershipDirectory from '@/components/church-membership-directory';

export const metadata={title:'Church membership | Super Admin'};
export default async function MembersPage(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/super-admin/login');
 const {data:profile,error}=await db.from('profiles').select('role,is_suspended').eq('user_id',user.id).single();
 if(error||profile?.role!=='superadmin'||profile.is_suspended)redirect('/leaders');
 return <ChurchMembershipDirectory/>;
}
