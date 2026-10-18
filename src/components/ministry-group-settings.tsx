"use client";
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {cleanGroupLink,type YouthRules} from '@/lib/ministry-routing';
export type MinistryGroup={id:string;name:string;invite_url:string;updated_at:string};
function GroupEditor({group,onSaved}:{group:MinistryGroup;onSaved:()=>void}){
 const[value,setValue]=useState(group.invite_url),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;const link=value.trim()?cleanGroupLink(value):'';if(link===null){setNotice('Enter a link starting with https://chat.whatsapp.com/.');return;}setBusy(true);try{const{error}=await createClient().from('ministry_whatsapp_groups').update({invite_url:link,updated_at:new Date().toISOString()}).eq('id',group.id).select('id').single();if(error)throw error;setValue(link);setNotice('Group link saved privately.');onSaved();}catch{setNotice('The link could not be saved.');}finally{setBusy(false);}}
 return <form onSubmit={save} className="ministry-setting-row"><label>{group.name}<input type="url" value={value} onChange={e=>setValue(e.target.value)} placeholder="Private group invite link" autoComplete="off"/></label><button disabled={busy} className="ministry-admin-button">Save link</button>{notice&&<p role="status">{notice}</p>}</form>;
}
export default function MinistryGroupSettings({groups,rules,onSaved}:{groups:MinistryGroup[];rules:YouthRules;onSaved:()=>void}){
 const[values,setValues]=useState(rules),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);try{const{error}=await createClient().from('ministry_youth_rules').update(values).eq('id',true).select('id').single();if(error)throw error;setNotice('Age ranges saved for new requests. Existing requests keep their original group.');onSaved();}catch{setNotice('Check age ranges: Early Youths starts at 13 or older; Young Adults starts after Early Youths ends.');}finally{setBusy(false);}}
 return <details className="ministry-admin-settings"><summary>WhatsApp group links &amp; youth age ranges</summary><p>Group links are private to Super Admin. Invitations need approval, applicant consent and completed WhatsApp setup.</p>{groups.map(group=><GroupEditor key={group.id} group={group} onSaved={onSaved}/>)}<form onSubmit={save}><h3>Youth routing</h3><div className="ministry-age-fields">{(['early_min','early_max','adult_min','adult_max'] as const).map(key=><label key={key}>{{early_min:'Early Youths minimum',early_max:'Early Youths maximum',adult_min:'Young Adults minimum',adult_max:'Young Adults maximum'}[key]}<input type="number" required min={13} max={120} value={values[key]} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>)}</div><button disabled={busy} className="ministry-admin-button">Save age ranges</button>{notice&&<p role="status">{notice}</p>}</form></details>;
}
