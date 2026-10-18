begin;
create table public.ministry_whatsapp_groups(
 id text primary key check(id in ('men','women','early-youth','young-adults','praise-team')),
 name text not null,invite_url text not null default '' check(invite_url='' or invite_url ~ '^https://chat[.]whatsapp[.]com/[A-Za-z0-9]+$'),updated_at timestamptz not null default now());
alter table public.ministry_whatsapp_groups enable row level security;
revoke all on public.ministry_whatsapp_groups from anon,authenticated;
grant select,update(invite_url,updated_at) on public.ministry_whatsapp_groups to authenticated;
create policy ministry_groups_admin_read on public.ministry_whatsapp_groups for select to authenticated using((select private.is_superadmin()));
create policy ministry_groups_admin_update on public.ministry_whatsapp_groups for update to authenticated using((select private.is_superadmin())) with check((select private.is_superadmin()));
insert into public.ministry_whatsapp_groups(id,name,invite_url) values
 ('men','Men',''),
 ('women','Women / Zoe Ladies',''),
 ('early-youth','Early Youths / Teens',''),
 ('young-adults','Young Adults',''),
 ('praise-team','Praise Team','');
create table public.ministry_youth_rules(
 id boolean primary key default true check(id),early_min integer not null default 13,early_max integer not null default 18,
 adult_min integer not null default 19,adult_max integer not null default 34,
 check(early_min>=13 and early_max>=early_min and adult_min>early_max and adult_max>=adult_min and adult_max<=120));
insert into public.ministry_youth_rules(id) values(true);
alter table public.ministry_youth_rules enable row level security;
revoke all on public.ministry_youth_rules from anon,authenticated;
grant select,update on public.ministry_youth_rules to authenticated;
create policy youth_rules_admin on public.ministry_youth_rules for all to authenticated using((select private.is_superadmin())) with check((select private.is_superadmin()));
create function public.get_ministry_youth_rules() returns table(early_min integer,early_max integer,adult_min integer,adult_max integer)
language sql stable security definer set search_path='' as $$select early_min,early_max,adult_min,adult_max from public.ministry_youth_rules where id;$$;
revoke all on function public.get_ministry_youth_rules() from public;
grant execute on function public.get_ministry_youth_rules() to anon,authenticated;
alter table public.ministry_join_requests drop constraint ministry_join_requests_status_check,
 add constraint ministry_join_requests_status_check check(status in ('pending','contacted','closed','approved','rejected')),
 add column age integer check(age between 0 and 120),
 add column whatsapp_consent boolean not null default false,
 add column consent_recorded_at timestamptz,
 add column assigned_group text references public.ministry_whatsapp_groups(id),
 add column review_notes text not null default '' check(length(review_notes)<=1000);
revoke insert,update on public.ministry_join_requests from anon,authenticated;
create table public.ministry_whatsapp_outbox(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.ministry_join_requests(id),
 group_id text not null references public.ministry_whatsapp_groups(id),
 state text not null default 'awaiting_setup' check(state in ('awaiting_setup','queued','sending','accepted','delivered','read','failed','unknown','cancelled')),
 provider_message_id text unique,last_error text not null default '',attempts integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.ministry_whatsapp_outbox enable row level security;
revoke all on public.ministry_whatsapp_outbox from anon,authenticated;
grant select on public.ministry_whatsapp_outbox to authenticated;
create policy ministry_outbox_admin_read on public.ministry_whatsapp_outbox for select to authenticated using((select private.is_superadmin()));
create table public.ministry_whatsapp_receipts(message_id text not null,state text not null check(state in ('accepted','delivered','read','failed')),error_note text not null default '',created_at timestamptz not null default now(),primary key(message_id,state));
alter table public.ministry_whatsapp_receipts enable row level security;
revoke all on public.ministry_whatsapp_receipts from anon,authenticated;
create function public.submit_ministry_request(p_ministry text,p_name text,p_phone text,p_message text,p_age integer,p_consent boolean) returns void
language plpgsql security definer set search_path='' as $$
declare phone_value text;group_value text;rules public.ministry_youth_rules;
begin
 if p_ministry is null or p_ministry not in ('youth','women','men','praise-team') or p_name is null or length(trim(p_name)) not between 1 and 160 or p_phone is null or length(p_phone)>40 or p_message is null or length(p_message)>1000 or p_consent is null then raise exception 'Invalid ministry request';end if;
 phone_value:=regexp_replace(p_phone,'[^0-9]','','g');
 if length(phone_value)=10 and left(phone_value,1)='0' then phone_value:='260'||substr(phone_value,2);elsif left(phone_value,2)='00' then phone_value:=substr(phone_value,3);end if;
 if phone_value !~ '^[1-9][0-9]{7,14}$' then raise exception 'Enter a complete WhatsApp phone number';end if;
 if p_ministry='youth' then
  if p_age is null or p_age not between 0 and 120 then raise exception 'Enter a valid age';end if;
  select * into rules from public.ministry_youth_rules where id;
  group_value:=case when p_age between rules.early_min and rules.early_max then 'early-youth' when p_age between rules.adult_min and rules.adult_max then 'young-adults' else null end;
 else group_value:=p_ministry;end if;
 perform pg_advisory_xact_lock(hashtextextended('ministry:'||phone_value,0));
 if (select count(*) from public.ministry_join_requests where phone='+'||phone_value and created_at>now()-interval '1 hour')>=3 then raise exception 'Please try again later';end if;
 if exists(select 1 from public.ministry_join_requests where phone='+'||phone_value and ministry=p_ministry and status in ('pending','contacted')) then raise exception 'A request for this ministry is already waiting for review';end if;
 insert into public.ministry_join_requests(ministry,name,phone,message,age,whatsapp_consent,consent_recorded_at,assigned_group)
 values(p_ministry,trim(p_name),'+'||phone_value,trim(p_message),case when p_ministry='youth' then p_age end,p_consent,case when p_consent then now() end,group_value);
end;$$;
revoke all on function public.submit_ministry_request(text,text,text,text,integer,boolean) from public;
grant execute on function public.submit_ministry_request(text,text,text,text,integer,boolean) to anon,authenticated;
create function public.review_ministry_request(p_id uuid,p_status text,p_notes text default '') returns void
language plpgsql security definer set search_path='' as $$
declare r public.ministry_join_requests;
begin
 if not private.is_superadmin() then raise exception 'Super Admin access required';end if;
 if p_status is null or p_status not in ('pending','contacted','closed','approved','rejected') or p_notes is null or length(p_notes)>1000 then raise exception 'Invalid review';end if;
 select * into r from public.ministry_join_requests where id=p_id for update;
 if not found then raise exception 'Request unavailable';end if;
 if r.status='approved' and p_status<>'approved' then raise exception 'An approved invitation cannot be recalled. Close it with the ministry leader directly';end if;
 update public.ministry_join_requests set status=p_status,review_notes=trim(p_notes),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 if p_status='approved' and r.whatsapp_consent and r.assigned_group is not null then
  insert into public.ministry_whatsapp_outbox(request_id,group_id) values(r.id,r.assigned_group) on conflict(request_id) do nothing;
 end if;
end;$$;
revoke all on function public.review_ministry_request(uuid,text,text) from public,anon;
grant execute on function public.review_ministry_request(uuid,text,text) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261016000100',array[]::text[],'ministry_approvals') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
