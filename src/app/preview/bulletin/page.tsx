import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import WeeklyBulletinPreview from '@/components/weekly-bulletin-preview';
export const metadata:Metadata={title:'Weekly bulletin preview | Zoe Branch',robots:{index:false,follow:false}};
export default function BulletinPreviewPage(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <WeeklyBulletinPreview/>;
}
