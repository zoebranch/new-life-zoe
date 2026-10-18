import {notFound,redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {createClient} from '@/lib/supabase/server';
import WeeklyBulletinPreview from '@/components/weekly-bulletin-preview';
export const metadata:Metadata={title:'Weekly encouragement preview | Super Admin',robots:{index:false,follow:false}};
export default async function AdminBulletinPreview(){
 if(process.env.NODE_ENV!=='development')notFound();
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user)redirect('/super-admin/login');
 const{data:profile,error}=await db.from('profiles').select('role,is_suspended').eq('user_id',user.id).single();
 if(error||profile?.role!=='superadmin'||profile.is_suspended)redirect('/leaders');
 return <WeeklyBulletinPreview editorPreview/>;
}
