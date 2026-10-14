begin;
create table public.ministry_join_requests (
 id uuid primary key default gen_random_uuid(),
 ministry text not null check (ministry in ('youth','women','men','praise-team')),
 name text not null check (length(trim(name)) between 1 and 160),
 phone text not null check (length(trim(phone)) between 3 and 40),
 message text not null default '' check (length(message)<=1000),
 status text not null default 'pending' check (status in ('pending','contacted','closed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.ministry_join_requests enable row level security;
revoke all on public.ministry_join_requests from anon,authenticated;
grant insert on public.ministry_join_requests to anon,authenticated;
grant select,update on public.ministry_join_requests to authenticated;
create policy ministry_requests_public_insert on public.ministry_join_requests for insert to anon,authenticated
 with check (status='pending' and reviewed_at is null and reviewed_by is null);
create policy ministry_requests_admin_read on public.ministry_join_requests for select to authenticated
 using ((select private.is_superadmin()));
create policy ministry_requests_admin_update on public.ministry_join_requests for update to authenticated
 using ((select private.is_superadmin())) with check ((select private.is_superadmin()) and reviewed_by=auth.uid() and reviewed_at is not null);
create index ministry_requests_status_date on public.ministry_join_requests(status,created_at);
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261009000300',array[]::text[],'ministry_join_requests') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
