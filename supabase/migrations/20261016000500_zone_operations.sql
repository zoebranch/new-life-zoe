begin;
create function private.can_manage_zone(p_zone bigint) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles p join public.zones z on z.id=p.zone_id where p.user_id=auth.uid() and p.role='zone_leader' and not p.is_suspended and z.is_active and p.zone_id=p_zone);$$;
revoke all on function private.can_manage_zone(bigint) from public,anon;
grant execute on function private.can_manage_zone(bigint) to authenticated;
alter table public.attendance_reports add column review_version bigint not null default 1;
alter table public.evangelism_reports add column review_version bigint not null default 1;
create function private.bump_report_review_version() returns trigger language plpgsql set search_path='' as $$begin new.review_version:=old.review_version+1;return new;end;$$;
revoke all on function private.bump_report_review_version() from public,anon,authenticated;
create trigger bump_attendance_review before update on public.attendance_reports for each row execute function private.bump_report_review_version();
create trigger bump_evangelism_review before update on public.evangelism_reports for each row execute function private.bump_report_review_version();
create table public.cell_report_feedback(
 id uuid primary key default gen_random_uuid(),attendance_id uuid references public.attendance_reports(id) on delete restrict,evangelism_id uuid references public.evangelism_reports(id) on delete restrict,
 cell_id bigint not null references public.cells(id),report_version bigint not null,status text not null check(status in ('reviewed','changes_requested')),notes text not null default '' check(length(notes)<=2000),reviewed_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check((attendance_id is not null)::int+(evangelism_id is not null)::int=1));
create index cell_report_feedback_cell on public.cell_report_feedback(cell_id,created_at desc);
alter table public.cell_report_feedback enable row level security;
revoke all on public.cell_report_feedback from anon,authenticated;
grant select on public.cell_report_feedback to authenticated;
create policy feedback_read on public.cell_report_feedback for select to authenticated using((select private.is_superadmin()) or exists(select 1 from public.cells c where c.id=cell_report_feedback.cell_id and private.can_manage_zone(c.zone_id)) or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='cell_leader' and not p.is_suspended and p.cell_id=cell_report_feedback.cell_id));
create function public.review_cell_report(p_kind text,p_report uuid,p_version bigint,p_status text,p_notes text) returns void language plpgsql security definer set search_path='' as $$
declare cell bigint; zone bigint; version bigint;
begin
 if p_kind='attendance' then select cell_id,review_version into cell,version from public.attendance_reports where id=p_report for update;
 elsif p_kind='evangelism' then select cell_id,review_version into cell,version from public.evangelism_reports where id=p_report for update;
 else raise exception 'Invalid report kind';end if;
 select zone_id into zone from public.cells where id=cell and is_active;
 if zone is null or not private.can_manage_zone(zone) then raise exception 'Zone access denied';end if;
 if p_version is null or version<>p_version then raise exception 'REPORT_CHANGED';end if;
 if p_status is null or p_status not in ('reviewed','changes_requested') or p_notes is null or length(p_notes)>2000 or (p_status='changes_requested' and length(trim(p_notes))=0) then raise exception 'Add a correction note';end if;
 insert into public.cell_report_feedback(attendance_id,evangelism_id,cell_id,report_version,status,notes,reviewed_by) values(case when p_kind='attendance' then p_report end,case when p_kind='evangelism' then p_report end,cell,version,p_status,trim(p_notes),auth.uid());
end;$$;
revoke all on function public.review_cell_report(text,uuid,bigint,text,text) from public,anon;
grant execute on function public.review_cell_report(text,uuid,bigint,text,text) to authenticated;
create table public.zone_tasks(
 id uuid primary key default gen_random_uuid(),zone_id bigint not null references public.zones(id),cell_id bigint references public.cells(id),kind text not null check(kind in ('followup','visit','escalation')),
 title text not null check(length(trim(title)) between 1 and 160),details text not null default '' check(length(details)<=2000),assignee text not null default '' check(length(assignee)<=160),due_date date,visit_time time,
 status text not null default 'open' check(status in ('open','in_progress','completed')),pastor_response text not null default '' check(length(pastor_response)<=2000),created_by uuid not null references auth.users(id),version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index zone_tasks_scope on public.zone_tasks(zone_id,status,due_date);
create table public.zone_task_history(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.zone_tasks(id) on delete restrict,actor_id uuid not null references auth.users(id),before_record jsonb,after_record jsonb not null,created_at timestamptz not null default now());
alter table public.zone_tasks enable row level security;alter table public.zone_task_history enable row level security;
revoke all on public.zone_tasks,public.zone_task_history from anon,authenticated;
grant select on public.zone_tasks,public.zone_task_history to authenticated;
create policy zone_tasks_read on public.zone_tasks for select to authenticated using((select private.is_superadmin()) or private.can_manage_zone(zone_id));
create policy zone_task_history_read on public.zone_task_history for select to authenticated using(exists(select 1 from public.zone_tasks t where t.id=task_id and ((select private.is_superadmin()) or private.can_manage_zone(t.zone_id))));
create function public.save_zone_task(p_id uuid,p_version bigint,p_cell bigint,p_kind text,p_title text,p_details text,p_assignee text,p_due date,p_time time,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare z bigint; old_row public.zone_tasks; new_row public.zone_tasks;
begin
 select zone_id into z from public.profiles where user_id=auth.uid() and role='zone_leader' and not is_suspended;
 if z is null or not private.can_manage_zone(z) then raise exception 'Zone access denied';end if;
 if p_id is not null then select * into old_row from public.zone_tasks where id=p_id for update;if not found or old_row.zone_id<>z then raise exception 'Task unavailable';end if;if p_version is null or p_version<>old_row.version then raise exception 'TASK_CHANGED';end if;if p_kind is distinct from old_row.kind then raise exception 'Task type cannot change';end if;end if;
 if p_cell is not null and not exists(select 1 from public.cells where id=p_cell and zone_id=z and is_active) then raise exception 'Choose a cell in your zone';end if;
 if p_kind is null or p_kind not in ('followup','visit','escalation') or p_title is null or length(trim(p_title)) not between 1 and 160 or p_details is null or length(p_details)>2000 or p_assignee is null or length(p_assignee)>160 or p_status is null or p_status not in ('open','in_progress','completed') or (p_kind in ('followup','visit') and p_due is null) or (p_kind='visit' and (p_cell is null or p_time is null)) then raise exception 'Check task details, date and time';end if;
 if p_kind='escalation' and (length(trim(p_details))=0 or p_status<>coalesce(old_row.status,'open')) then raise exception 'Only Super Admin can update escalation status';end if;
 if p_id is null then
 insert into public.zone_tasks(zone_id,cell_id,kind,title,details,assignee,due_date,visit_time,status,created_by) values(z,p_cell,p_kind,trim(p_title),trim(p_details),trim(p_assignee),p_due,case when p_kind='visit' then p_time end,p_status,auth.uid()) returning * into new_row;
 else
 update public.zone_tasks set cell_id=p_cell,title=trim(p_title),details=trim(p_details),assignee=trim(p_assignee),due_date=p_due,visit_time=case when p_kind='visit' then p_time end,status=p_status,version=version+1,updated_at=clock_timestamp() where id=p_id returning * into new_row;
 end if;
 insert into public.zone_task_history(task_id,actor_id,before_record,after_record) values(new_row.id,auth.uid(),case when p_id is null then null else to_jsonb(old_row) end,to_jsonb(new_row));return new_row.id;
end;$$;
revoke all on function public.save_zone_task(uuid,bigint,bigint,text,text,text,text,date,time,text) from public,anon;
grant execute on function public.save_zone_task(uuid,bigint,bigint,text,text,text,text,date,time,text) to authenticated;
create function public.respond_zone_escalation(p_id uuid,p_version bigint,p_status text,p_response text) returns void language plpgsql security definer set search_path='' as $$
declare old_row public.zone_tasks; new_row public.zone_tasks;
begin
 if not private.is_superadmin() then raise exception 'Super Admin access required';end if;
 select * into old_row from public.zone_tasks where id=p_id and kind='escalation' for update;if not found then raise exception 'Escalation unavailable';end if;
 if p_version is null or p_version<>old_row.version then raise exception 'TASK_CHANGED';end if;
 if p_status is null or p_status not in ('open','in_progress','completed') or p_response is null or length(trim(p_response)) not between 1 and 2000 then raise exception 'Add a response and choose a status';end if;
 update public.zone_tasks set status=p_status,pastor_response=trim(p_response),version=version+1,updated_at=clock_timestamp() where id=p_id returning * into new_row;
 insert into public.zone_task_history(task_id,actor_id,before_record,after_record) values(p_id,auth.uid(),to_jsonb(old_row),to_jsonb(new_row));
end;$$;
revoke all on function public.respond_zone_escalation(uuid,bigint,text,text) from public,anon;
grant execute on function public.respond_zone_escalation(uuid,bigint,text,text) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261016000500',array[]::text[],'zone_operations') on conflict(version) do nothing;
notify pgrst,'reload schema';commit;
