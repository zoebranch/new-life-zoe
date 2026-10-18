import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const env={};for(const line of (await fs.readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^"|"$/g,'');}
const options={auth:{persistSession:false,autoRefreshToken:false}};
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
const checks=[];
for(const table of ['outreach_team','outreach_contacts','outreach_history']){const r=await anon.from(table).select('id');checks.push({check:'anonymous table access '+table,denied:!!r.error});}
const g=await anon.rpc('outreach_guest',{p_token:'a'.repeat(64)});checks.push({check:'invalid private link',denied:g.error?.message.includes('OUTREACH_LINK_UNAVAILABLE')===true});
const d=await anon.rpc('outreach_dashboard');checks.push({check:'anonymous leader dashboard',denied:!!d.error});
console.log(JSON.stringify(checks));if(checks.some(c=>!c.denied))process.exitCode=1;
