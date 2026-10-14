begin;
create or replace function private.cell_member_identity(p_name text,p_phone text) returns text language sql immutable set search_path='' as $$
 select case when length(regexp_replace(p_phone,'[^0-9]','','g'))<7 then null else lower(regexp_replace(trim(p_name),'\s+',' ','g'))||':'||case when length(regexp_replace(p_phone,'[^0-9]','','g'))=10 and left(regexp_replace(p_phone,'[^0-9]','','g'),1)='0' then '260'||substr(regexp_replace(p_phone,'[^0-9]','','g'),2) when left(regexp_replace(p_phone,'[^0-9]','','g'),5)='00260' then substr(regexp_replace(p_phone,'[^0-9]','','g'),3) else regexp_replace(p_phone,'[^0-9]','','g') end end;
$$;
create or replace function private.enforce_single_cell() returns trigger language plpgsql security definer set search_path='' as $$
declare identity_key text;
begin
 identity_key:=private.cell_member_identity(new.name,new.phone);
 if identity_key is null then
  if tg_table_name='member_join_requests' then raise exception using errcode='P0001',message='CELL_CONTACT_INVALID'; end if;
  return new;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(identity_key,0));
 if tg_table_name='member_join_requests' then
  if new.status<>'pending' then return new; end if;
  if exists(select 1 from public.members m where private.cell_member_identity(m.name,m.phone)=identity_key) or exists(select 1 from public.member_join_requests r where r.id<>new.id and r.status='pending' and private.cell_member_identity(r.name,r.phone)=identity_key) then raise exception using errcode='P0001',message='CELL_ALREADY_REGISTERED'; end if;
 else
  if exists(select 1 from public.members m where m.id<>new.id and private.cell_member_identity(m.name,m.phone)=identity_key) or exists(select 1 from public.member_join_requests r where r.status='pending' and r.cell_id<>new.cell_id and private.cell_member_identity(r.name,r.phone)=identity_key) then raise exception using errcode='P0001',message='CELL_ALREADY_REGISTERED'; end if;
 end if;
 return new;
end;
$$;
revoke all on function private.enforce_single_cell() from public,anon,authenticated;
revoke all on function private.cell_member_identity(text,text) from public,anon,authenticated;
create trigger enforce_single_cell_join before insert or update on public.member_join_requests for each row execute function private.enforce_single_cell();
create trigger enforce_single_cell_member before insert or update of name,phone,cell_id on public.members for each row execute function private.enforce_single_cell();
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261009000500',array[]::text[],'single_cell_membership') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
