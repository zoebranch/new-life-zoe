begin;
create table public.cell_attendance_registers(
 cell_id bigint not null references public.cells(id),meeting_date date not null,
 roster jsonb not null check(jsonb_typeof(roster)='array'),version bigint not null default 1,
 operation_id uuid not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(cell_id,meeting_date)
);
create table public.cell_attendance_history(
 id bigint generated always as identity primary key,cell_id bigint not null,meeting_date date not null,
 version bigint not null,roster jsonb not null,actor_id uuid not null references auth.users(id),saved_at timestamptz not null default now(),
 unique(cell_id,meeting_date,version),foreign key(cell_id,meeting_date) references public.cell_attendance_registers(cell_id,meeting_date)
);
alter table public.cell_attendance_registers enable row level security;
alter table public.cell_attendance_history enable row level security;
revoke all on public.cell_attendance_registers,public.cell_attendance_history from anon,authenticated;

create function public.cell_attendance_get(p_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope bigint:=private.outreach_cell();record public.cell_attendance_registers;draft jsonb;
begin
 if p_date is null or p_date<date '1900-01-01' or p_date>(now() at time zone 'Africa/Lusaka')::date then raise exception 'ATTENDANCE_DATE';end if;
 select * into record from public.cell_attendance_registers where cell_id=scope and meeting_date=p_date;
 if found then return jsonb_build_object('date',p_date,'version',record.version,'roster',record.roster,'savedAt',record.updated_at);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'status',null) order by m.name,m.id),'[]'::jsonb) into draft
 from public.members m where m.cell_id=scope and m.is_active and (m.joined_at at time zone 'Africa/Lusaka')::date<=p_date;
 return jsonb_build_object('date',p_date,'version',0,'roster',draft,'savedAt',null);
end;$$;

create function public.cell_attendance_save(p_date date,p_version bigint,p_entries jsonb,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope bigint:=private.outreach_cell();current_record jsonb;expected jsonb;clean jsonb;next_version bigint;
begin
 if p_operation is null or p_version is null or p_version<0 then raise exception 'ATTENDANCE_INPUT';end if;
 -- One writer per cell; stale screens cannot overwrite another saved register.
 perform 1 from public.cells where id=scope for update;
 current_record:=public.cell_attendance_get(p_date);expected:=current_record->'roster';
 if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 5000 then raise exception 'ATTENDANCE_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(p_entries) e where e->>'id' is null or e->>'status' is null or e->>'status' not in ('present','absent'))
 or (select count(distinct e->>'id') from jsonb_array_elements(p_entries) e)<>jsonb_array_length(p_entries)
 or jsonb_array_length(expected)<>jsonb_array_length(p_entries)
 or exists(select 1 from jsonb_array_elements(expected) r where not exists(select 1 from jsonb_array_elements(p_entries) e where e->>'id'=r->>'id')) then raise exception 'ATTENDANCE_ROSTER_CHANGED';end if;
 select jsonb_agg(jsonb_build_object('id',r->>'id','name',r->>'name','status',e->>'status') order by ord) into clean
 from jsonb_array_elements(expected) with ordinality r(r,ord) join jsonb_array_elements(p_entries) e on e->>'id'=r->>'id';
 if exists(select 1 from public.cell_attendance_registers where cell_id=scope and meeting_date=p_date and operation_id=p_operation and roster=clean) then return current_record;end if;
 if (current_record->>'version')::bigint<>p_version then raise exception 'ATTENDANCE_CHANGED';end if;
 next_version:=p_version+1;
 insert into public.cell_attendance_registers(cell_id,meeting_date,roster,version,operation_id,updated_by) values(scope,p_date,clean,next_version,p_operation,auth.uid())
 on conflict(cell_id,meeting_date) do update set roster=excluded.roster,version=excluded.version,operation_id=excluded.operation_id,updated_by=excluded.updated_by,updated_at=now();
 insert into public.cell_attendance_history(cell_id,meeting_date,version,roster,actor_id) values(scope,p_date,next_version,clean,auth.uid());
 return public.cell_attendance_get(p_date);
end;$$;
revoke all on function public.cell_attendance_get(date),public.cell_attendance_save(date,bigint,jsonb,uuid) from public,anon;
grant execute on function public.cell_attendance_get(date),public.cell_attendance_save(date,bigint,jsonb,uuid) to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261017000200',array['Member attendance registers and correction history'],'member_attendance') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
