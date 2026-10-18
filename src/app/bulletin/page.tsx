import type{Metadata}from'next';
import PublicWeeklyBulletin from '@/components/public-weekly-bulletin';
import '../preview/bulletin/bulletin.css';
export const metadata:Metadata={title:'This week at Zoe | Weekly bulletin',description:'Weekly encouragement, church notices and service times from Zoe Branch.'};
export default function BulletinPage(){return <PublicWeeklyBulletin/>;}
