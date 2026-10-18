import{redirect}from'next/navigation';
import{createClient}from'@/lib/supabase/server';
import WeeklyBulletinManager from '@/components/weekly-bulletin-manager';
export default async function AdminBulletinPage(){const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect('/super-admin/login');const{data:profile,error}=await db.from('profiles').select('role,is_suspended').eq('user_id',user.id).single();if(error||profile?.role!=='superadmin'||profile.is_suspended)redirect('/leaders');return <WeeklyBulletinManager/>;}
