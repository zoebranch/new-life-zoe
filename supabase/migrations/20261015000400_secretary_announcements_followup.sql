begin;
create table public.church_announcements (
 id uuid primary key default gen_random_uuid(), source_request_id uuid references public.church_care_requests(id) on delete set null,
 title text not null check(length(trim(title)) between 1 and 160), body text not null check(length(trim(body)) between 1 and 3000),
 category text not null check(category in ('general','bereavement','newborn','hospital','other')),
 is_published boolean not null default false, expires_on date,
 permission_note text not null default '' check(length(permission_note)<=500),
 permission_confirmed_by uuid references auth.users(id),permission_confirmed_at timestamptz,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(not is_published or (length(trim(permission_note))>0 and permission_confirmed_by is not null and permission_confirmed_at is not null))
);
alter table public.church_announcements enable row level security;
revoke all on public.church_announcements from anon,authenticated;
grant select on public.church_announcements to authenticated;
create policy announcements_staff_read on public.church_announcements for select to authenticated using((select private.is_superadmin()) or (select private.is_secretary()));
create table public.church_announcement_activity (
 id uuid primary key default gen_random_uuid(),announcement_id uuid not null references public.church_announcements(id),actor_id uuid not null references auth.users(id),
 action text not null,title text not null,body text not null,permission_note text not null,created_at timestamptz not null default now()
);
alter table public.church_announcement_activity enable row level security;
revoke all on public.church_announcement_activity from anon,authenticated;
grant select on public.church_announcement_activity to authenticated;
create policy announcement_activity_staff_read on public.church_announcement_activity for select to authenticated using((select private.is_superadmin()) or (select private.is_secretary()));
create function public.save_church_announcement(p_id uuid,p_source uuid,p_title text,p_body text,p_category text,p_publish boolean,p_expires date,p_permission text,p_confirm boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not(private.is_superadmin() or private.is_secretary()) then raise exception 'Staff access required';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 160 or p_body is null or length(trim(p_body)) not between 1 and 3000 or p_category is null or p_category not in ('general','bereavement','newborn','hospital','other') or p_publish is null or p_permission is null or length(p_permission)>500 then raise exception 'Invalid announcement';end if;
 if p_source is not null and not exists(select 1 from public.church_care_requests where id=p_source and kind in ('bereavement','newborn','hospital','other')) then raise exception 'Care notice unavailable';end if;
 if p_publish and (p_confirm is distinct from true or length(trim(p_permission))=0 or (p_expires is not null and p_expires<(now() at time zone 'Africa/Lusaka')::date)) then raise exception 'Confirm publication permission and a valid expiry date';end if;
 if p_id is null then
  insert into public.church_announcements(source_request_id,title,body,category,is_published,expires_on,permission_note,permission_confirmed_by,permission_confirmed_at,created_by)
  values(p_source,trim(p_title),trim(p_body),p_category,p_publish,p_expires,trim(p_permission),case when p_publish then auth.uid() end,case when p_publish then now() end,auth.uid()) returning id into result;
 else
  update public.church_announcements set source_request_id=p_source,title=trim(p_title),body=trim(p_body),category=p_category,is_published=p_publish,expires_on=p_expires,permission_note=trim(p_permission),
   permission_confirmed_by=case when p_publish then auth.uid() end,permission_confirmed_at=case when p_publish then now() end,updated_at=now() where id=p_id returning id into result;
  if not found then raise exception 'Announcement unavailable';end if;
 end if;
 insert into public.church_announcement_activity(announcement_id,actor_id,action,title,body,permission_note) values(result,auth.uid(),case when p_publish then 'published' else 'draft' end,trim(p_title),trim(p_body),trim(p_permission));
 return result;
end; $$;
revoke all on function public.save_church_announcement(uuid,uuid,text,text,text,boolean,date,text,boolean) from public,anon;
grant execute on function public.save_church_announcement(uuid,uuid,text,text,text,boolean,date,text,boolean) to authenticated;
create function public.list_public_church_announcements() returns table(id uuid,title text,body text,category text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select id,title,body,category,updated_at from public.church_announcements where is_published and (expires_on is null or expires_on>=(now() at time zone 'Africa/Lusaka')::date) order by updated_at desc limit 20;
$$;
revoke all on function public.list_public_church_announcements() from public;
grant execute on function public.list_public_church_announcements() to anon,authenticated;
create table public.care_followups (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.church_care_requests(id),actor_id uuid not null references auth.users(id),
 stage text not null check(stage in ('contacted','visit_arranged','support_provided','completed')),notes text not null default '' check(length(notes)<=2000),next_followup date,created_at timestamptz not null default now()
);
alter table public.care_followups enable row level security;
revoke all on public.care_followups from anon,authenticated;
grant select on public.care_followups to authenticated;
create policy care_followups_staff_read on public.care_followups for select to authenticated using((select private.is_superadmin()) or (select private.is_secretary()));
create function public.add_care_followup(p_request uuid,p_stage text,p_notes text,p_next date) returns void language plpgsql security definer set search_path='' as $$
begin
 if not(private.is_superadmin() or private.is_secretary()) then raise exception 'Staff access required';end if;
 if p_stage is null or p_stage not in ('contacted','visit_arranged','support_provided','completed') or p_notes is null or length(p_notes)>2000 or (p_stage='completed' and p_next is not null) then raise exception 'Invalid follow-up';end if;
 if not exists(select 1 from public.church_care_requests where id=p_request and kind<>'prayer') then raise exception 'Request unavailable';end if;
 insert into public.care_followups(request_id,actor_id,stage,notes,next_followup) values(p_request,auth.uid(),p_stage,trim(p_notes),p_next);
end; $$;
revoke all on function public.add_care_followup(uuid,text,text,date) from public,anon;
grant execute on function public.add_care_followup(uuid,text,text,date) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261015000400',array[]::text[],'secretary_announcements_followup') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
