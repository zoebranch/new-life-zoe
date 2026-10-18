rollback;begin;
select set_config('ministry_test.admin',(select user_id::text from public.profiles where role='superadmin' and not is_suspended limit 1),true);
select set_config('ministry_test.secretary',(select user_id::text from public.profiles where role='secretary' limit 1),true);
set local role anon;
select public.submit_ministry_request('youth','MINISTRY TEST TEEN','0970000771','Validation only',18,true);
select public.submit_ministry_request('youth','MINISTRY TEST ADULT','0970000772','Validation only',19,true);
select public.submit_ministry_request('youth','MINISTRY TEST MANUAL','0970000773','Validation only',35,true);
select public.submit_ministry_request('women','MINISTRY TEST WOMEN','0970000774','Validation only',null,true);
select public.submit_ministry_request('men','MINISTRY TEST NO CONSENT','0970000775','Validation only',null,false);
select public.submit_ministry_request('men','MINISTRY TEST REJECT','0970000776','Validation only',null,true);
insert into public.ministry_join_requests(ministry,name,phone,age,assigned_group) values('youth','MINISTRY TEST LEGACY','0970000777',null,'young-adults');
do $$begin
 begin perform 1 from public.ministry_whatsapp_groups;raise exception 'TEST: group links exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.ministry_whatsapp_outbox;raise exception 'TEST: delivery queue exposed';exception when insufficient_privilege then null;end;
 begin insert into public.ministry_join_requests(ministry,name,phone,status) values('men','BYPASS','0970000779','approved');raise exception 'TEST: public self approval';exception when insufficient_privilege then null;end;
end$$;reset role;
do $$begin
 if not exists(select 1 from public.ministry_join_requests where name='MINISTRY TEST TEEN' and assigned_group='early-youth' and phone='+260970000771') then raise exception 'TEST: teen route';end if;
 if not exists(select 1 from public.ministry_join_requests where name='MINISTRY TEST ADULT' and assigned_group='young-adults') then raise exception 'TEST: adult route';end if;
 if not exists(select 1 from public.ministry_join_requests where name='MINISTRY TEST MANUAL' and assigned_group is null) then raise exception 'TEST: manual route';end if;
 if not exists(select 1 from public.ministry_join_requests where name='MINISTRY TEST LEGACY' and assigned_group is null and not whatsapp_consent) then raise exception 'TEST: legacy insert forged group routing';end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('ministry_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare test_row record;begin
 for test_row in select id from public.ministry_join_requests where name like 'MINISTRY TEST %' and name<>'MINISTRY TEST REJECT' loop perform public.review_ministry_request(test_row.id,'approved','Test approval');perform public.review_ministry_request(test_row.id,'approved','Repeat approval');end loop;
 perform public.review_ministry_request((select id from public.ministry_join_requests where name='MINISTRY TEST REJECT'),'rejected','Test rejection');
 if not exists(select 1 from public.ministry_join_requests where name='MINISTRY TEST REJECT' and status='rejected' and reviewed_by=auth.uid()) then raise exception 'TEST: rejection not recorded';end if;
 if(select count(*) from public.ministry_whatsapp_outbox o join public.ministry_join_requests r on r.id=o.request_id where r.name like 'MINISTRY TEST %')<>3 then raise exception 'TEST: duplicate, consent or manual routing queue failure';end if;
 if not exists(select 1 from public.ministry_whatsapp_outbox o join public.ministry_join_requests r on r.id=o.request_id where r.name='MINISTRY TEST WOMEN' and o.group_id='women' and o.state='awaiting_setup') then raise exception 'TEST: Women route queue';end if;
end$$;reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('ministry_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.ministry_whatsapp_groups) then raise exception 'TEST: secretary group access';end if;
 begin perform public.review_ministry_request(gen_random_uuid(),'approved','');raise exception 'TEST: secretary approval';exception when others then if sqlerrm<>'Super Admin access required' then raise;end if;end;
end$$;reset role;rollback;
select 'PASS: age routing, normalized phones, private groups, consent, approval queue, duplicate prevention and Super Admin-only reviews. All test data rolled back.' as result;
