rollback;
begin;
select set_config('zone_test.leader',(select user_id::text from public.profiles where role='zone_leader' and not is_suspended limit 1),true);
select set_config('zone_test.zone',(select zone_id::text from public.profiles where user_id=current_setting('zone_test.leader')::uuid),true);
select set_config('zone_test.cell_leader',(select p.user_id::text from public.profiles p join public.cells c on c.id=p.cell_id where p.role='cell_leader' and c.zone_id=current_setting('zone_test.zone')::bigint and not p.is_suspended limit 1),true);
select set_config('zone_test.cell',(select cell_id::text from public.profiles where user_id=current_setting('zone_test.cell_leader')::uuid),true);
select set_config('zone_test.foreign',(select c.id::text from public.cells c where c.zone_id<>current_setting('zone_test.zone')::bigint and c.is_active order by c.id limit 1),true);
select set_config('zone_test.admin',(select user_id::text from public.profiles where role='superadmin' and not is_suspended limit 1),true);
select set_config('zone_test.secretary',(select user_id::text from public.profiles where role='secretary' and not is_suspended limit 1),true);
with r as(insert into public.attendance_reports(cell_id,report_date,attendance,visitors,offering_amount,submitted_by) values(current_setting('zone_test.cell')::bigint,current_date-499,10,1,20,current_setting('zone_test.cell_leader')::uuid) returning id) select set_config('zone_test.report',(select id::text from r),true);
with r as(insert into public.evangelism_reports(cell_id,report_date,people_reached,tracts,souls_won,team_count,contacts,submitted_by) values(current_setting('zone_test.cell')::bigint,current_date-499,10,5,2,3,2,current_setting('zone_test.cell_leader')::uuid) returning id) select set_config('zone_test.outreach',(select id::text from r),true);
with r as(insert into public.attendance_reports(cell_id,report_date,attendance,visitors,offering_amount,submitted_by) values(current_setting('zone_test.foreign')::bigint,current_date-499,20,2,30,current_setting('zone_test.cell_leader')::uuid) returning id) select set_config('zone_test.foreign_report',(select id::text from r),true);
insert into public.cell_report_feedback(attendance_id,cell_id,report_version,status,notes,reviewed_by) values(current_setting('zone_test.foreign_report')::uuid,current_setting('zone_test.foreign')::bigint,1,'reviewed','FOREIGN PRIVATE FEEDBACK',current_setting('zone_test.leader')::uuid);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('zone_test.task',public.save_zone_task(null,null,current_setting('zone_test.cell')::bigint,'followup','ZONE TEST follow-up','Check report','Zone leader',current_date,null,'open')::text,true);
select public.save_zone_task(current_setting('zone_test.task')::uuid,1,current_setting('zone_test.cell')::bigint,'followup','ZONE TEST follow-up','Completed contact','Zone leader',current_date,null,'completed');
select public.save_zone_task(null,null,current_setting('zone_test.cell')::bigint,'visit','ZONE TEST visit','Cell visit','Zone leader',current_date,'10:00','open');
select set_config('zone_test.escalation',public.save_zone_task(null,null,current_setting('zone_test.cell')::bigint,'escalation','ZONE TEST escalation','Pastor guidance needed','Zone leader',null,null,'open')::text,true);
select public.review_cell_report('attendance',current_setting('zone_test.report')::uuid,1,'changes_requested','Please correct visitor count');
select public.review_cell_report('evangelism',current_setting('zone_test.outreach')::uuid,1,'reviewed','Outreach checked');
do $$begin
 if exists(select 1 from public.cell_report_feedback where cell_id=current_setting('zone_test.foreign')::bigint) then raise exception 'Foreign feedback visible to zone';end if;
 begin perform public.review_cell_report('attendance',current_setting('zone_test.foreign_report')::uuid,1,'reviewed','Forbidden');raise exception 'Foreign report review accepted';exception when others then if sqlerrm<>'Zone access denied' then raise;end if;end;
 begin perform public.save_zone_task(null,null,current_setting('zone_test.foreign')::bigint,'visit','Bad visit','Test','Test',current_date,'10:00','open');raise exception 'Foreign visit accepted';exception when others then if sqlerrm<>'Choose a cell in your zone' then raise;end if;end;
 begin perform public.save_zone_task(current_setting('zone_test.task')::uuid,1,current_setting('zone_test.cell')::bigint,'followup','Stale','Test','Test',current_date,null,'open');raise exception 'Stale task accepted';exception when others then if sqlerrm<>'TASK_CHANGED' then raise;end if;end;
 begin perform public.save_zone_task(current_setting('zone_test.escalation')::uuid,1,current_setting('zone_test.cell')::bigint,'escalation','ZONE TEST escalation','Test','Test',null,null,'completed');raise exception 'Zone closed escalation';exception when others then if sqlerrm<>'Only Super Admin can update escalation status' then raise;end if;end;
 begin perform public.respond_zone_escalation(current_setting('zone_test.escalation')::uuid,1,'completed','Forged pastor response');raise exception 'Zone replied as pastor';exception when others then if sqlerrm<>'Super Admin access required' then raise;end if;end;
 begin update public.zone_tasks set pastor_response='Bypass' where id=current_setting('zone_test.escalation')::uuid;raise exception 'Direct write bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.cell_leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.cell_report_feedback where attendance_id=current_setting('zone_test.report')::uuid and status='changes_requested') then raise exception 'Cell cannot see correction';end if;
 if exists(select 1 from public.cell_report_feedback where cell_id=current_setting('zone_test.foreign')::bigint) then raise exception 'Foreign feedback visible to cell';end if;
 if exists(select 1 from public.zone_tasks) then raise exception 'Cell can read private zone tasks';end if;
 begin perform public.save_zone_task(null,null,null,'escalation','Forbidden','Forbidden','Test',null,null,'open');raise exception 'Cell created zone task';exception when others then if sqlerrm<>'Zone access denied' then raise;end if;end;
end $$;
update public.attendance_reports set visitors=2 where id=current_setting('zone_test.report')::uuid;
update public.evangelism_reports set people_reached=12 where id=current_setting('zone_test.outreach')::uuid;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 begin perform public.review_cell_report('attendance',current_setting('zone_test.report')::uuid,1,'reviewed','Stale');raise exception 'Stale report review accepted';exception when others then if sqlerrm<>'REPORT_CHANGED' then raise;end if;end;
end $$;
select public.review_cell_report('attendance',current_setting('zone_test.report')::uuid,2,'reviewed','Correction checked');
select public.review_cell_report('evangelism',current_setting('zone_test.outreach')::uuid,2,'reviewed','Correction checked');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.respond_zone_escalation(current_setting('zone_test.escalation')::uuid,1,'in_progress','Pastor response saved');
do $$begin
 if (select count(*) from public.zone_task_history where task_id=current_setting('zone_test.escalation')::uuid)<>2 then raise exception 'Escalation history incomplete';end if;
 if (select count(*) from public.cell_report_feedback where attendance_id=current_setting('zone_test.report')::uuid)<>2 then raise exception 'Review history incomplete';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.leader'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.zone_tasks where id=current_setting('zone_test.escalation')::uuid and pastor_response='Pastor response saved' and status='in_progress') then raise exception 'Pastor response invisible';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('zone_test.secretary'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.zone_tasks) or exists(select 1 from public.cell_report_feedback) then raise exception 'Secretary private zone access';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.zone_tasks;raise exception 'Anonymous zone access';exception when insufficient_privilege then null;end;
 begin perform 1 from public.cell_report_feedback;raise exception 'Anonymous feedback access';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: scoped follow-ups and visits, private tasks, pastor response restrictions/history, cell feedback access, correction revisions and stale-write protection. All validation data rolled back.' as result;
