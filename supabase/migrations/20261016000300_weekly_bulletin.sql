begin;
create table public.weekly_bulletins(
 id uuid primary key default gen_random_uuid(),week_start date not null unique check(extract(dow from week_start)=0),
 title text not null check(length(trim(title)) between 1 and 100),intro text not null check(length(trim(intro)) between 1 and 500),
 scripture text not null default '' check(length(scripture)<=600),reference text not null default '' check(length(reference)<=80),
 is_published boolean not null default false,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
alter table public.weekly_bulletins enable row level security;
revoke all on public.weekly_bulletins from anon,authenticated;
grant select on public.weekly_bulletins to authenticated;
create policy weekly_bulletins_admin on public.weekly_bulletins for select to authenticated using((select private.is_superadmin()));
create function public.get_public_weekly_bulletin() returns table(id uuid,week_start date,title text,intro text,scripture text,reference text)
language sql stable security definer set search_path='' as $$select id,week_start,title,intro,scripture,reference from public.weekly_bulletins where is_published order by week_start desc limit 1;$$;
revoke all on function public.get_public_weekly_bulletin() from public;
grant execute on function public.get_public_weekly_bulletin() to anon,authenticated;
create function public.save_weekly_bulletin(p_id uuid,p_week date,p_title text,p_intro text,p_scripture text,p_reference text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.is_superadmin() then raise exception 'Super Admin access required';end if;
 if p_week is null or extract(dow from p_week)<>0 or p_title is null or length(trim(p_title)) not between 1 and 100 or p_intro is null or length(trim(p_intro)) not between 1 and 500 or p_scripture is null or length(p_scripture)>600 or p_reference is null or length(p_reference)>80 or p_publish is null then raise exception 'Check bulletin fields and choose a Sunday';end if;
 if p_id is null then insert into public.weekly_bulletins(week_start,title,intro,scripture,reference,is_published,updated_by) values(p_week,trim(p_title),trim(p_intro),trim(p_scripture),trim(p_reference),p_publish,auth.uid()) returning id into result;
 else update public.weekly_bulletins set week_start=p_week,title=trim(p_title),intro=trim(p_intro),scripture=trim(p_scripture),reference=trim(p_reference),is_published=p_publish,updated_by=auth.uid(),updated_at=now() where id=p_id returning id into result;
 if not found then raise exception 'Bulletin unavailable';end if;end if;
 return result;
end;$$;
revoke all on function public.save_weekly_bulletin(uuid,date,text,text,text,text,boolean) from public,anon;
grant execute on function public.save_weekly_bulletin(uuid,date,text,text,text,text,boolean) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261016000300',array[]::text[],'weekly_bulletin') on conflict(version) do nothing;
notify pgrst,'reload schema';commit;
