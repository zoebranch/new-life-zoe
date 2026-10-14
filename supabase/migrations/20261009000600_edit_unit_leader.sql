begin;
create or replace function public.edit_unit_leader(p_kind text,p_id bigint,p_name text,p_phone text,p_reassign boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_superadmin() then raise exception 'Super Admin access required';end if;
 if p_kind not in ('cell','zone') or p_kind is null or p_reassign is null or length(trim(p_name)) not between 1 and 160 or p_name is null or p_phone is null or length(p_phone)>40 then raise exception 'Enter valid leader details';end if;
 if p_kind='cell' then
  update public.cells set leader=trim(p_name),phone=trim(p_phone) where id=p_id;
  if not found then raise exception 'Cell not found';end if;
  update public.profiles set display_name=trim(p_name),is_suspended=case when p_reassign then true else is_suspended end where role='cell_leader' and cell_id=p_id;
 else
  update public.zones set leader=trim(p_name),phone=trim(p_phone) where id=p_id;
  if not found then raise exception 'Zone not found';end if;
  update public.profiles set display_name=trim(p_name),is_suspended=case when p_reassign then true else is_suspended end where role='zone_leader' and zone_id=p_id;
 end if;
end;
$$;
revoke all on function public.edit_unit_leader(text,bigint,text,text,boolean) from public,anon;
grant execute on function public.edit_unit_leader(text,bigint,text,text,boolean) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261009000600',array[]::text[],'edit_unit_leader') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
