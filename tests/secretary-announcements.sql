rollback;
begin;
select set_config('zoe_test.secretary',(select user_id::text from public.profiles where role='secretary' and username='newlifezoe2@gmail.com'),true);
select set_config('zoe_test.leader',(select user_id::text from public.profiles where role='cell_leader' limit 1),true);
with r as(insert into public.church_care_requests(kind,name,phone,message,subject_name) values('other','VALIDATION ONLY','0970000999','PRIVATE MESSAGE MUST STAY PRIVATE','Test family') returning id) select set_config('zoe_test.care',(select id::text from r),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('zoe_test.announcement',public.save_church_announcement(null,current_setting('zoe_test.care')::uuid,'VALIDATION ONLY','Approved public text','other',false,null,'',false)::text,true);
do $$begin
 if not exists(select 1 from public.church_announcements where id=current_setting('zoe_test.announcement')::uuid) then raise exception 'TEST: secretary cannot read draft';end if;
 begin perform public.save_church_announcement(current_setting('zoe_test.announcement')::uuid,null,'VALIDATION ONLY','Must not publish','other',true,null,'',false);raise exception 'TEST: published without permission';exception when others then if sqlerrm<>'Confirm publication permission and a valid expiry date' then raise;end if;end;
 begin insert into public.church_announcements(title,body,category,created_by) values('Bypass','Bypass','general',auth.uid());raise exception 'TEST: direct write bypass';exception when insufficient_privilege then null;end;
 perform public.add_care_followup(current_setting('zoe_test.care')::uuid,'visit_arranged','PRIVATE FOLLOW-UP',current_date+1);
 if not exists(select 1 from public.care_followups where request_id=current_setting('zoe_test.care')::uuid) then raise exception 'TEST: follow-up not saved';end if;
end $$;
reset role;
set local role anon;
do $$begin
 if exists(select 1 from public.list_public_church_announcements() where id=current_setting('zoe_test.announcement')::uuid) then raise exception 'TEST: draft exposed';end if;
 begin perform 1 from public.church_announcements;raise exception 'TEST: private announcement fields exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.care_followups;raise exception 'TEST: follow-ups exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
select public.save_church_announcement(current_setting('zoe_test.announcement')::uuid,current_setting('zoe_test.care')::uuid,'VALIDATION ONLY','Approved public text','other',true,current_date+1,'Family permission recorded for validation',true);
reset role;
set local role anon;
do $$begin
 if not exists(select 1 from public.list_public_church_announcements() where id=current_setting('zoe_test.announcement')::uuid and body='Approved public text') then raise exception 'TEST: publication missing';end if;
end $$;
reset role;
update public.church_announcements set expires_on=current_date-1 where id=current_setting('zoe_test.announcement')::uuid;
set local role anon;
do $$begin
 if exists(select 1 from public.list_public_church_announcements() where id=current_setting('zoe_test.announcement')::uuid) then raise exception 'TEST: expired announcement exposed';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.church_announcements where id=current_setting('zoe_test.announcement')::uuid) then raise exception 'TEST: leader private draft access';end if;
 if exists(select 1 from public.care_followups where request_id=current_setting('zoe_test.care')::uuid) then raise exception 'TEST: leader follow-up access';end if;
 begin perform public.save_church_announcement(null,null,'No access','No access','general',false,null,'',false);raise exception 'TEST: leader published';exception when others then if sqlerrm<>'Staff access required' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zoe_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
select public.save_church_announcement(current_setting('zoe_test.announcement')::uuid,null,'VALIDATION ONLY','Approved public text','other',false,null,'',false);
reset role;
set local role anon;
do $$begin
 if exists(select 1 from public.list_public_church_announcements() where id=current_setting('zoe_test.announcement')::uuid) then raise exception 'TEST: unpublish failed';end if;
end $$;
reset role;
rollback;
select 'PASS: drafts private, permission required, publication/unpublish, follow-up privacy and role checks. All validation data rolled back.' as result;
