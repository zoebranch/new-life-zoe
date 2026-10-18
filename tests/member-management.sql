rollback;
begin;
select set_config('member_test.admin',(select user_id::text from public.profiles where role='superadmin' and not is_suspended limit 1),true);
select set_config('member_test.leader',(select user_id::text from public.profiles where role='cell_leader' and not is_suspended limit 1),true);
select set_config('member_test.cell',(select cell_id::text from public.profiles where user_id=current_setting('member_test.leader')::uuid),true);
select set_config('member_test.target',(select c.id::text from public.cells c join public.zones z on z.id=c.zone_id where c.id<>current_setting('member_test.cell')::bigint and c.is_active and z.is_active order by c.id limit 1),true);
select set_config('member_test.secretary',(select user_id::text from public.profiles where role='secretary' limit 1),true);
with m as(insert into public.members(cell_id,name,gender,age,phone,area) values(current_setting('member_test.cell')::bigint,'MEMBER TEST ORIGINAL','Female',30,'0970000991','Test area') returning id) select set_config('member_test.id',(select id::text from m),true);
with m as(insert into public.members(cell_id,name,gender,age,phone) values(current_setting('member_test.target')::bigint,'MEMBER TEST OTHER','Male',31,'0970000992') returning id) select set_config('member_test.other',(select id::text from m),true);
select set_config('member_test.joined',(select joined_at::text from public.members where id=current_setting('member_test.id')::uuid),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('member_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.members(cell_id,name,gender,age,phone,area) values(current_setting('member_test.cell')::bigint,'MEMBER TEST DIRECT ADD','Female',28,'0970000993','Validation');
do $$begin
 begin insert into public.members(cell_id,name,gender,age,phone,is_active) values(current_setting('member_test.cell')::bigint,'MEMBER TEST BYPASS','Female',28,'0970000994',false);raise exception 'Protected insert bypass';exception when insufficient_privilege then null;end;
end $$;
select public.manage_church_member(current_setting('member_test.id')::uuid,'details','{"name":"MEMBER TEST CORRECTED","gender":"Female","age":32,"phone":"0970000991","area":"Corrected area"}','Correction validation',1);
do $$begin
 if not exists(select 1 from public.members where id=current_setting('member_test.id')::uuid and age=32 and name='MEMBER TEST CORRECTED') then raise exception 'Correction failed';end if;
 begin perform public.manage_church_member(current_setting('member_test.other')::uuid,'deactivate','{}','Out of scope',1);raise exception 'Foreign member changed';exception when others then if sqlerrm<>'Member access denied' then raise;end if;end;
 begin perform public.manage_church_member(current_setting('member_test.id')::uuid,'transfer',jsonb_build_object('cell_id',current_setting('member_test.target')::bigint),'Blocked transfer',2);raise exception 'Leader transferred member';exception when others then if sqlerrm<>'Only Super Admin can transfer members' then raise;end if;end;
 begin update public.members set is_active=false where id=current_setting('member_test.id')::uuid;raise exception 'Direct write bypass';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.member_history) then raise exception 'Leader read admin history';end if;
end $$;
select public.submit_cell_prayer_request('MEMBER TEST CORRECTED','0970000991','VALIDATION ONLY - original cell prayer');
select public.manage_church_member(current_setting('member_test.id')::uuid,'deactivate','{}','Inactive validation',2);
do $$begin
 begin perform public.submit_cell_prayer_request('MEMBER TEST CORRECTED','0970000991','Must not submit');raise exception 'Inactive prayer allowed';exception when others then if sqlerrm<>'Unable to submit prayer request' then raise;end if;end;
 begin perform public.manage_church_member(current_setting('member_test.id')::uuid,'reactivate','{}','Stale validation',2);raise exception 'Stale edit allowed';exception when others then if sqlerrm<>'MEMBER_CHANGED' then raise;end if;end;
end $$;
select public.manage_church_member(current_setting('member_test.id')::uuid,'reactivate','{}','Reactivation validation',3);
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('member_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 begin perform public.manage_church_member(current_setting('member_test.id')::uuid,'deactivate','{}','Secretary denied',4);raise exception 'Secretary changed member';exception when others then if sqlerrm<>'Member access denied' then raise;end if;end;
 if exists(select 1 from public.member_history) then raise exception 'Secretary read history';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('member_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.manage_church_member(current_setting('member_test.id')::uuid,'transfer',jsonb_build_object('cell_id',current_setting('member_test.target')::bigint),'Transfer validation',4);
do $$begin
 if not exists(select 1 from public.members where id=current_setting('member_test.id')::uuid and cell_id=current_setting('member_test.target')::bigint and joined_at=current_setting('member_test.joined')::timestamptz and record_version=5) then raise exception 'Transfer identity/date/version failed';end if;
 if not exists(select 1 from public.cell_prayer_requests where member_id=current_setting('member_test.id')::uuid and cell_id=current_setting('member_test.cell')::bigint) then raise exception 'Historical prayer moved';end if;
 if (select count(*) from public.member_history where member_id=current_setting('member_test.id')::uuid)<>4 then raise exception 'History incomplete';end if;
 begin perform public.manage_church_member(current_setting('member_test.id')::uuid,'details','{"name":"MEMBER TEST OTHER","gender":"Female","age":32,"phone":"0970000992","area":"Duplicate"}','Duplicate validation',5);raise exception 'Duplicate identity accepted';exception when others then if sqlerrm<>'CELL_ALREADY_REGISTERED' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('member_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.members where id=current_setting('member_test.id')::uuid) then raise exception 'Former leader retains member access';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.member_history;raise exception 'Anonymous history access';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: own-cell corrections/status, transfer restricted to Super Admin, scope/privacy, stale edits, duplicate identity, full history and original prayer retention. Test records rolled back.' as result;
