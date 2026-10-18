begin;
alter table public.members add column is_active boolean not null default true, add column record_version bigint not null default 1;
-- All changes to existing members pass through the scoped, audited function.
revoke update,delete,insert on public.members from authenticated;
grant insert(cell_id,name,gender,age,phone,area) on public.members to authenticated;
create table public.member_history(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members(id) on delete restrict,
 action text not null check(action in ('details','transfer','deactivate','reactivate')),actor_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 1 and 500),before_record jsonb not null,after_record jsonb not null,created_at timestamptz not null default now());
create index member_history_member on public.member_history(member_id,created_at desc);
alter table public.member_history enable row level security;
revoke all on public.member_history from anon,authenticated;
grant select on public.member_history to authenticated;
create policy member_history_admin on public.member_history for select to authenticated using((select private.is_superadmin()));
create function public.manage_church_member(p_member uuid,p_action text,p_changes jsonb,p_reason text,p_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare m public.members; result public.members; admin_ok boolean; target bigint; p public.profiles;
begin
 select * into p from public.profiles where user_id=auth.uid();
 admin_ok:=coalesce(private.is_superadmin(),false);
 if not admin_ok and (p.role is distinct from 'cell_leader'::public.app_role or p.is_suspended) then raise exception 'Member access denied';end if;
 select * into m from public.members where id=p_member for update;
 if not found then raise exception 'Member unavailable';end if;
 if not admin_ok and (p.cell_id is distinct from m.cell_id or not private.can_manage_cell(m.cell_id)) then raise exception 'Member access denied';end if;
 if p_action is null or p_action not in ('details','transfer','deactivate','reactivate') or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Choose an action and give a reason';end if;
 if p_version is null or p_version<>m.record_version then raise exception 'MEMBER_CHANGED';end if;
 if p_action='details' then
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes->>'name' is null or length(trim(p_changes->>'name')) not between 1 and 160 or p_changes->>'gender' is null or p_changes->>'gender' not in ('Male','Female') or p_changes->>'age' is null or (p_changes->>'age')!~'^[0-9]{1,3}$' or (p_changes->>'age')::integer not between 0 and 120 or p_changes->>'phone' is null or length(p_changes->>'phone')>40 or private.cell_member_identity(p_changes->>'name',p_changes->>'phone') is null or length(coalesce(p_changes->>'area',''))>200 then raise exception 'Check member details and phone number';end if;
  update public.members set name=trim(p_changes->>'name'),gender=p_changes->>'gender',age=(p_changes->>'age')::integer,phone=trim(p_changes->>'phone'),area=trim(coalesce(p_changes->>'area','')),record_version=record_version+1 where id=m.id returning * into result;
 elsif p_action='transfer' then
  if not admin_ok then raise exception 'Only Super Admin can transfer members';end if;
  if p_changes->>'cell_id' is null or (p_changes->>'cell_id')!~'^[0-9]+$' then raise exception 'Choose an active destination cell';end if;
  target:=(p_changes->>'cell_id')::bigint;
  if target=m.cell_id then raise exception 'Choose a different destination cell';end if;
  if not exists(select 1 from public.cells c join public.zones z on z.id=c.zone_id where c.id=target and c.is_active and z.is_active) then raise exception 'Choose an active destination cell';end if;
  update public.members set cell_id=target,record_version=record_version+1 where id=m.id returning * into result;
 else
  if m.is_active=(p_action='reactivate') then raise exception 'Member already has this status';end if;
  if p_action='reactivate' and not exists(select 1 from public.cells c join public.zones z on z.id=c.zone_id where c.id=m.cell_id and c.is_active and z.is_active) then raise exception 'Restore or transfer the cell before reactivating this member';end if;
  update public.members set is_active=(p_action='reactivate'),record_version=record_version+1 where id=m.id returning * into result;
 end if;
 insert into public.member_history(member_id,action,actor_id,reason,before_record,after_record) values(m.id,p_action,auth.uid(),trim(p_reason),to_jsonb(m),to_jsonb(result));
end;$$;
revoke all on function public.manage_church_member(uuid,text,jsonb,text,bigint) from public,anon;
grant execute on function public.manage_church_member(uuid,text,jsonb,text,bigint) to authenticated;
create or replace function public.submit_cell_prayer_request(p_name text,p_phone text,p_message text) returns void language plpgsql security definer set search_path='' as $$
declare identity_key text;m public.members;matches bigint;
begin
 if p_name is null or p_phone is null or p_message is null or length(trim(p_name)) not between 1 and 160 or length(p_phone)>40 or length(trim(p_message)) not between 1 and 2000 then raise exception 'Unable to submit prayer request';end if;
 identity_key:=private.cell_member_identity(p_name,p_phone);
 if identity_key is null then raise exception 'Unable to submit prayer request';end if;
 perform pg_advisory_xact_lock(hashtextextended('prayer:'||identity_key,0));
 select count(*) into matches from public.members mm join public.cells c on c.id=mm.cell_id join public.zones z on z.id=c.zone_id where private.cell_member_identity(mm.name,mm.phone)=identity_key and mm.is_active and c.is_active and z.is_active;
 if matches<>1 then raise exception 'Unable to submit prayer request';end if;
 select mm.* into m from public.members mm join public.cells c on c.id=mm.cell_id join public.zones z on z.id=c.zone_id where private.cell_member_identity(mm.name,mm.phone)=identity_key and mm.is_active and c.is_active and z.is_active;
 if (select count(*) from public.cell_prayer_requests where member_id=m.id and created_at>now()-interval '1 hour')>=3 then raise exception 'Unable to submit prayer request';end if;
 insert into public.cell_prayer_requests(member_id,cell_id,member_name,message) values(m.id,m.cell_id,m.name,trim(p_message));
end;
$$;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261016000400',array[]::text[],'member_management') on conflict(version) do nothing;
notify pgrst,'reload schema';commit;
