rollback;
begin;
select set_config('zoe_test.admin',(select user_id::text from public.profiles where role='superadmin' limit 1),true);
select set_config('zoe_test.secretary',(select user_id::text from public.profiles where role='secretary' limit 1),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('zoe_test.bulletin',public.save_weekly_bulletin(null,date '2099-01-04','VALIDATION ONLY','Validation encouragement','','',false)::text,true);
reset role;
set local role anon;
do $$begin
 if exists(select 1 from public.get_public_weekly_bulletin() where id=current_setting('zoe_test.bulletin')::uuid) then raise exception 'Draft exposed';end if;
 begin perform 1 from public.weekly_bulletins;raise exception 'Direct table exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.weekly_bulletins) then raise exception 'Secretary can read private drafts';end if;
 begin perform public.save_weekly_bulletin(null,date '2099-01-11','Blocked','Blocked','','',true);raise exception 'Secretary can publish';exception when others then if sqlerrm<>'Super Admin access required' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.save_weekly_bulletin(current_setting('zoe_test.bulletin')::uuid,date '2099-01-04','VALIDATION ONLY','Validation encouragement','Validation scripture','Validation reference',true);
reset role;
set local role anon;
do $$begin
 if not exists(select 1 from public.get_public_weekly_bulletin() where id=current_setting('zoe_test.bulletin')::uuid and scripture='Validation scripture') then raise exception 'Published content missing';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.save_weekly_bulletin(current_setting('zoe_test.bulletin')::uuid,date '2099-01-04','VALIDATION ONLY','Validation encouragement','','',false);
reset role;
set local role anon;
do $$begin
 if exists(select 1 from public.get_public_weekly_bulletin() where id=current_setting('zoe_test.bulletin')::uuid) then raise exception 'Unpublish failed';end if;
end $$;
reset role;
rollback;
select 'PASS: Super Admin publishing, secretary blocked, anonymous draft privacy, publication and unpublish. All test data rolled back.' as result;

