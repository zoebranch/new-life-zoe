import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const env={};for(const line of (await fs.readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^"|"$/g,'');}
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const table of ['cell_attendance_registers','cell_attendance_history']){const result=await db.from(table).select('*');assert.equal(result.error?.code,'42501',table+' must reject public access');}
const result=await db.rpc('cell_attendance_get',{p_date:'2026-10-17'});assert.equal(result.error?.code,'42501','Named attendance must reject signed-out access');
console.log('PASS: attendance tables and register function exist and reject anonymous access.');
