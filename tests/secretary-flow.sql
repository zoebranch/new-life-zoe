-- Run in the SQL editor as project owner. Every test record and role assignment is rolled back.
rollback;
begin;
select set_config('zoe_test.leader',(select user_id::text from public.profiles where role='cell_leader' and not is_suspended limit 1),true);
select set_config('zoe_test.cell',(select cell_id::text from public.profiles where user_id=current_setting('zoe_test.leader')::uuid),true);
select set_config('zoe_test.secretary',(select user_id::text from public.profiles where role='secretary' and username='newlifezoe2@gmail.com'),true);
insert into public.members(cell_id,name,gender,age,phone,area) values(current_setting('zoe_test.cell')::bigint,'ZOE SYSTEM CHECK','Male',30,'0970000999','Validation only');
with r as(insert into public.church_care_requests(kind,name,phone,message,subject_name) values('other','ZOE SYSTEM CHECK','0970000999','Validation only','Test family') returning id) select set_config('zoe_test.care',(select id::text from r),true);
with r as(insert into public.church_care_requests(kind,name,phone,requested_date) values('appointment','ZOE SYSTEM CHECK','0970000999',current_date+10) returning id) select set_config('zoe_test.appointment',(select id::text from r),true);
with r as(insert into public.church_care_requests(kind,name,phone,requested_date) values('appointment','ZOE SYSTEM CHECK','0970000999',current_date+10) returning id) select set_config('zoe_test.conflict',(select id::text from r),true);

set local role anon;
select public.submit_cell_prayer_request(' zoe  system check ','+260970000999','Validation only');
select public.submit_cell_prayer_request('ZOE SYSTEM CHECK','0970000999','Validation only');
select public.submit_cell_prayer_request('ZOE SYSTEM CHECK','0970000999','Validation only');
do $$begin
 begin perform public.submit_cell_prayer_request('ZOE SYSTEM CHECK','0970000999','Fourth request must fail');raise exception 'TEST: rate limit failed';exception when others then if sqlerrm<>'Unable to submit prayer request' then raise;end if;end;
 begin perform public.submit_cell_prayer_request('Unknown member','0970000998','Unregistered must fail');raise exception 'TEST: membership check failed';exception when others then if sqlerrm<>'Unable to submit prayer request' then raise;end if;end;
 begin perform 1 from public.cell_prayer_requests;raise exception 'TEST: anonymous prayer access';exception when insufficient_privilege then null;end;
 begin insert into public.church_care_requests(kind,name,phone,message) values('prayer','ZOE SYSTEM CHECK','0970000999','Must not bypass member routing');raise exception 'TEST: legacy prayer bypass';exception when insufficient_privilege then null;end;
end$$;
reset role;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.church_care_requests where id=current_setting('zoe_test.care')::uuid) then raise exception 'TEST: secretary care access';end if;
 if exists(select 1 from public.cell_prayer_requests) then raise exception 'TEST: secretary read cell prayers';end if;
 if exists(select 1 from public.members) then raise exception 'TEST: secretary read members';end if;
 begin perform public.review_care_request(current_setting('zoe_test.appointment')::uuid,'approved','Validation only',current_date-1,'10:00');raise exception 'TEST: past appointment allowed';exception when others then if sqlerrm<>'Choose a valid future appointment slot' then raise;end if;end;
 perform public.review_care_request(current_setting('zoe_test.appointment')::uuid,'approved','Validation only',current_date+10,'10:00');
 begin perform public.review_care_request(current_setting('zoe_test.conflict')::uuid,'approved','Validation only',current_date+10,'10:00');raise exception 'TEST: double booking';exception when unique_violation then null;end;
 perform public.review_care_request(current_setting('zoe_test.conflict')::uuid,'rejected','Validation only');
end$$;
reset role;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare request_id uuid;begin
 select id into request_id from public.cell_prayer_requests where member_name='ZOE SYSTEM CHECK' limit 1;
 if request_id is null then raise exception 'TEST: cell leader did not receive prayer';end if;
 perform public.review_cell_prayer_request(request_id,'praying');
 if exists(select 1 from public.church_care_requests where id=current_setting('zoe_test.care')::uuid) then raise exception 'TEST: cell leader read secretary care';end if;
 begin perform public.review_care_request(current_setting('zoe_test.care')::uuid,'closed','Unauthorized');raise exception 'TEST: cell leader reviewed secretary care';exception when others then if sqlerrm<>'Staff access required' then raise;end if;end;
end$$;
reset role;

update public.profiles set cell_id=(select id from public.cells where id<>current_setting('zoe_test.cell')::bigint and is_active limit 1) where user_id=current_setting('zoe_test.leader')::uuid;
set local role authenticated;
do $$begin if exists(select 1 from public.cell_prayer_requests where member_name='ZOE SYSTEM CHECK') then raise exception 'TEST: another cell can read prayer';end if;end$$;
reset role;
rollback;
select 'PASS: membership matching, rate limits, secretary permissions, prayer routing, cross-cell privacy, and appointment conflicts. All test data rolled back.' as result;
