begin;
create table public.church_care_requests (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('prayer','visit','appointment')),
 email text not null default '' check(length(email)<=254),
 requested_date date,
 preferred_time text not null default '' check(length(preferred_time)<=80),
 guests integer not null default 1 check(guests between 1 and 50),
 name text not null check (length(trim(name)) between 0 and 160),
 phone text not null check (length(trim(phone)) between 0 and 40),
 message text not null default '' check (length(message)<=2000),
 constraint care_contact_required check (kind='prayer' or (length(trim(name))>0 and (length(trim(phone))>=3 or length(trim(email))>=3))),
 constraint care_date_required check(kind='prayer' or requested_date is not null),
 constraint care_prayer_required check(kind<>'prayer' or length(trim(message))>0),
 status text not null default 'pending' check (status in ('pending','contacted','closed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.church_care_requests enable row level security;
revoke all on public.church_care_requests from anon,authenticated;
grant insert on public.church_care_requests to anon,authenticated;
grant select,update on public.church_care_requests to authenticated;
create policy care_requests_public_insert on public.church_care_requests for insert to anon,authenticated
 with check (status='pending' and reviewed_at is null and reviewed_by is null);
create policy care_requests_admin_read on public.church_care_requests for select to authenticated
 using ((select private.is_superadmin()));
create policy care_requests_admin_update on public.church_care_requests for update to authenticated
 using ((select private.is_superadmin())) with check ((select private.is_superadmin()) and reviewed_by=auth.uid() and reviewed_at is not null);
create index care_requests_status_date on public.church_care_requests(status,created_at);
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261009000400',array[]::text[],'church_care_requests') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;

