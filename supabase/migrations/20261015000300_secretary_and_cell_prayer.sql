begin;
alter table public.profiles drop constraint profiles_check;
alter table public.profiles add constraint profiles_check check (
 (role in ('superadmin','secretary') and cell_id is null and zone_id is null)
 or (role='zone_leader' and cell_id is null and zone_id is not null)
 or (role='cell_leader' and cell_id is not null and zone_id is null));
alter table public.leader_invites drop constraint leader_invites_role_check,drop constraint leader_invites_scope_matches_role;
alter table public.leader_invites add constraint leader_invites_role_check check(role in ('cell_leader','zone_leader','secretary')),
 add constraint leader_invites_scope_matches_role check((role='secretary' and cell_id is null and zone_id is null) or (role='cell_leader' and cell_id is not null and zone_id is null) or (role='zone_leader' and cell_id is null and zone_id is not null));
create or replace function private.is_secretary() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where user_id=auth.uid() and role='secretary' and not is_suspended);
$$;
revoke all on function private.is_secretary() from public,anon;
grant execute on function private.is_secretary() to authenticated;

alter table public.church_care_requests drop constraint church_care_requests_kind_check,drop constraint church_care_requests_status_check,
 add column confirmed_date date,add column confirmed_time time,add column staff_notes text not null default '' check(length(staff_notes)<=4000);
alter table public.church_care_requests add constraint church_care_requests_kind_check check(kind in ('visit','appointment','prayer','bereavement','newborn','hospital','other')),
 add constraint church_care_requests_status_check check(status in ('pending','contacted','approved','rejected','closed'));
alter table public.church_care_requests drop constraint care_notice_required,drop constraint care_announcement_request_kind;
alter table public.church_care_requests add constraint care_notice_required check(kind not in ('bereavement','newborn','hospital','other') or (length(trim(subject_name))>0 and length(trim(message))>0)),
 add constraint care_announcement_request_kind check(not announcement_requested or kind in ('bereavement','newborn','hospital','other')),
 add constraint appointment_confirmation_required check(status not in ('approved','rejected') or kind='appointment'),
 add constraint approved_appointment_slot_required check(status<>'approved' or (confirmed_date is not null and confirmed_time is not null));
create unique index care_unique_approved_appointment on public.church_care_requests(confirmed_date,confirmed_time) where kind='appointment' and status='approved';
drop policy care_requests_public_insert on public.church_care_requests;
create policy care_requests_public_insert on public.church_care_requests for insert to anon,authenticated with check(kind<>'prayer' and status='pending' and reviewed_at is null and reviewed_by is null and confirmed_date is null and confirmed_time is null and staff_notes='');
create policy care_requests_secretary_read on public.church_care_requests for select to authenticated using(kind<>'prayer' and (select private.is_secretary()));

create table public.care_request_activity (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.church_care_requests(id) on delete cascade,
 actor_id uuid not null references auth.users(id),status text not null,notes text not null default '',created_at timestamptz not null default now());
alter table public.care_request_activity enable row level security;
revoke all on public.care_request_activity from anon,authenticated;
grant select on public.care_request_activity to authenticated;
create policy care_activity_staff_read on public.care_request_activity for select to authenticated using((select private.is_superadmin()) or ((select private.is_secretary()) and exists(select 1 from public.church_care_requests r where r.id=request_id and r.kind<>'prayer')));

create or replace function public.review_care_request(p_id uuid,p_status text,p_notes text default '',p_date date default null,p_time time default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.church_care_requests;
begin
 if not (private.is_superadmin() or private.is_secretary()) then raise exception 'Staff access required';end if;
 if p_status is null or p_status not in ('pending','contacted','approved','rejected','closed') or p_notes is null or length(p_notes)>4000 then raise exception 'Invalid review';end if;
 select * into r from public.church_care_requests where id=p_id for update;
 if not found or r.kind='prayer' then raise exception 'Request unavailable';end if;
 if p_status in ('approved','rejected') and r.kind<>'appointment' then raise exception 'Only appointments can be approved or rejected';end if;
 if p_status='approved' and (p_date is null or p_time is null or (p_date+p_time)<(now() at time zone 'Africa/Lusaka')) then raise exception 'Choose a valid future appointment slot';end if;
 update public.church_care_requests set status=p_status,staff_notes=trim(p_notes),confirmed_date=case when p_status='approved' then p_date else null end,
 confirmed_time=case when p_status='approved' then p_time else null end,reviewed_at=now(),reviewed_by=auth.uid() where id=p_id;
 insert into public.care_request_activity(request_id,actor_id,status,notes) values(p_id,auth.uid(),p_status,trim(p_notes));
end;
$$;
revoke all on function public.review_care_request(uuid,text,text,date,time) from public,anon;
grant execute on function public.review_care_request(uuid,text,text,date,time) to authenticated;

create table public.cell_prayer_requests (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members(id) on delete restrict,
 cell_id bigint not null references public.cells(id) on delete restrict,member_name text not null,message text not null check(length(trim(message)) between 1 and 2000),
 status text not null default 'pending' check(status in ('pending','praying','closed')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id));
create index cell_prayer_scope on public.cell_prayer_requests(cell_id,status,created_at);
alter table public.cell_prayer_requests enable row level security;
revoke all on public.cell_prayer_requests from anon,authenticated;
grant select on public.cell_prayer_requests to authenticated;
create policy cell_prayer_leader_read on public.cell_prayer_requests for select to authenticated using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='cell_leader' and p.cell_id=cell_prayer_requests.cell_id and not p.is_suspended));
create policy cell_prayer_superadmin_read on public.cell_prayer_requests for select to authenticated using((select private.is_superadmin()));

create or replace function public.submit_cell_prayer_request(p_name text,p_phone text,p_message text) returns void language plpgsql security definer set search_path='' as $$
declare identity_key text;m public.members;matches bigint;
begin
 if p_name is null or p_phone is null or p_message is null or length(trim(p_name)) not between 1 and 160 or length(p_phone)>40 or length(trim(p_message)) not between 1 and 2000 then raise exception 'Unable to submit prayer request';end if;
 identity_key:=private.cell_member_identity(p_name,p_phone);
 if identity_key is null then raise exception 'Unable to submit prayer request';end if;
 perform pg_advisory_xact_lock(hashtextextended('prayer:'||identity_key,0));
 select count(*) into matches from public.members mm join public.cells c on c.id=mm.cell_id join public.zones z on z.id=c.zone_id where private.cell_member_identity(mm.name,mm.phone)=identity_key and c.is_active and z.is_active;
 if matches<>1 then raise exception 'Unable to submit prayer request';end if;
 select mm.* into m from public.members mm join public.cells c on c.id=mm.cell_id join public.zones z on z.id=c.zone_id where private.cell_member_identity(mm.name,mm.phone)=identity_key and c.is_active and z.is_active;
 if (select count(*) from public.cell_prayer_requests where member_id=m.id and created_at>now()-interval '1 hour')>=3 then raise exception 'Unable to submit prayer request';end if;
 insert into public.cell_prayer_requests(member_id,cell_id,member_name,message) values(m.id,m.cell_id,m.name,trim(p_message));
end;
$$;
revoke all on function public.submit_cell_prayer_request(text,text,text) from public;
grant execute on function public.submit_cell_prayer_request(text,text,text) to anon,authenticated;

create or replace function public.review_cell_prayer_request(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status is null or p_status not in ('pending','praying','closed') then raise exception 'Invalid status';end if;
 update public.cell_prayer_requests r set status=p_status,reviewed_at=now(),reviewed_by=auth.uid()
 where r.id=p_id and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='cell_leader' and p.cell_id=r.cell_id and not p.is_suspended);
 if not found then raise exception 'Prayer request unavailable';end if;
end;
$$;
revoke all on function public.review_cell_prayer_request(uuid,text) from public,anon;
grant execute on function public.review_cell_prayer_request(uuid,text) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261015000200',array[]::text[],'secretary_role'),('20261015000300',array[]::text[],'secretary_and_cell_prayer') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
