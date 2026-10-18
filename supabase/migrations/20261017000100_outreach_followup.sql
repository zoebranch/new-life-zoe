begin;
create table public.outreach_team (
 id uuid primary key default gen_random_uuid(),cell_id bigint not null references public.cells(id),name text not null check(length(trim(name)) between 1 and 160),phone text not null default '' check(length(phone)<=40),
 is_active boolean not null default true,token_hash text unique,link_expires_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(id,cell_id),
 check(token_hash is null or token_hash~'^[0-9a-f]{64}$')
);
create table public.outreach_contacts (
 id uuid primary key default gen_random_uuid(),cell_id bigint not null references public.cells(id),name text not null check(length(trim(name)) between 1 and 160),phone text not null unique check(phone~'^[0-9]{7,15}$'),area text not null default '' check(length(area)<=200),met_on date not null,
 consent boolean not null default false,assignee_id uuid,status text not null default 'new' check(status in ('new','no_answer','following_up','invited','attended','completed','do_not_contact')),next_due date,version bigint not null default 1,created_at timestamptz not null default now(),
 foreign key(assignee_id,cell_id) references public.outreach_team(id,cell_id),check(status<>'do_not_contact' or (not consent and next_due is null))
);
create table public.outreach_history (
 id uuid primary key default gen_random_uuid(),contact_id uuid not null references public.outreach_contacts(id),actor text not null,kind text not null check(kind in ('assignment','call','status')),message text not null check(length(message)<=2300),created_at timestamptz not null default now()
);
create index outreach_contacts_cell on public.outreach_contacts(cell_id,created_at desc);
create index outreach_contacts_queue on public.outreach_contacts(assignee_id,next_due);
create index outreach_history_contact on public.outreach_history(contact_id,created_at desc);
alter table public.outreach_team enable row level security;
alter table public.outreach_contacts enable row level security;
alter table public.outreach_history enable row level security;
revoke all on public.outreach_team,public.outreach_contacts,public.outreach_history from anon,authenticated;

create function private.outreach_cell() returns bigint language plpgsql stable security definer set search_path='' as $$
declare result bigint;
begin
 select p.cell_id into result from public.profiles p join public.cells c on c.id=p.cell_id join public.zones z on z.id=c.zone_id
 where p.user_id=auth.uid() and p.role='cell_leader' and not p.is_suspended and c.is_active and z.is_active;
 if result is null then raise exception 'OUTREACH_ACCESS_DENIED';end if;return result;
end;$$;
create function private.outreach_phone(p_phone text) returns text language plpgsql immutable set search_path='' as $$
declare result text;
begin
 if p_phone is null or length(p_phone)>40 or p_phone!~'^[+0-9 ()-]+$' then raise exception 'Check the phone number';end if;
 result:=regexp_replace(p_phone,'[^0-9]','','g');
 if left(result,5)='00260' then result:=substr(result,3);
 elsif length(result)=10 and left(result,1)='0' then result:='260'||substr(result,2);end if;
 if length(result) not between 7 and 15 then raise exception 'Check the phone number';end if;return result;
end;$$;
create function private.outreach_snapshot(p_cell bigint,p_team uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'team',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'phone',case when p_team is null then t.phone else '' end,'active',t.is_active,'expiresAt',t.link_expires_at) order by t.created_at,t.id) from public.outreach_team t where t.cell_id=p_cell and (p_team is null or t.id=p_team)),'[]'::jsonb),
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'area',c.area,'metOn',c.met_on,'consent',c.consent,'assignee',c.assignee_id,'status',c.status,'nextDue',c.next_due,'version',c.version,'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'actor',h.actor,'kind',h.kind,'message',h.message,'at',h.created_at) order by h.created_at desc,h.id) from public.outreach_history h where h.contact_id=c.id),'[]'::jsonb)) order by c.created_at desc,c.id)
 from public.outreach_contacts c where c.cell_id=p_cell and (p_team is null or (c.assignee_id=p_team and c.consent and c.status<>'do_not_contact'))),'[]'::jsonb));
$$;
create function public.outreach_dashboard() returns jsonb language sql stable security definer set search_path='' as $$select private.outreach_snapshot(private.outreach_cell());$$;

create function public.outreach_manage(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope bigint;who text;person public.outreach_contacts;teammate public.outreach_team;old_name text;target uuid;new_hash text;number text;item record;expected bigint;draft_id uuid;
begin
 scope:=private.outreach_cell();
 -- Every mutation (including guest updates) serializes on the cell, preventing overlapping assignment/removal.
 perform 1 from public.cells where id=scope for update;
 select coalesce(nullif(display_name,''),'Cell leader') into who from public.profiles where user_id=auth.uid();
 if p_action='add_team' then
  if p_payload->>'name' is null or length(trim(p_payload->>'name')) not between 1 and 160 or length(coalesce(p_payload->>'phone',''))>40 then raise exception 'Check the team member details';end if;
  if exists(select 1 from public.outreach_team where cell_id=scope and is_active and lower(trim(name))=lower(trim(p_payload->>'name'))) then raise exception 'This team member already exists';end if;
  insert into public.outreach_team(cell_id,name,phone,created_by) values(scope,trim(p_payload->>'name'),trim(coalesce(p_payload->>'phone','')),auth.uid());
 elsif p_action='add_contact' then
  number:=private.outreach_phone(p_payload->>'phone');draft_id:=(p_payload->>'id')::uuid;
  if draft_id is null or p_payload->>'name' is null or length(trim(p_payload->>'name')) not between 1 and 160 or length(coalesce(p_payload->>'area',''))>200 or p_payload->>'metOn' is null or p_payload->>'consent' is null then raise exception 'Check the contact details';end if;
  if exists(select 1 from public.outreach_contacts where id=draft_id and cell_id=scope and phone=number and name=trim(p_payload->>'name') and area=trim(coalesce(p_payload->>'area','')) and met_on=(p_payload->>'metOn')::date and consent=(p_payload->>'consent')::boolean) then return private.outreach_snapshot(scope);end if;
  begin
   insert into public.outreach_contacts(id,cell_id,name,phone,area,met_on,consent) values(draft_id,scope,trim(p_payload->>'name'),number,trim(coalesce(p_payload->>'area','')),(p_payload->>'metOn')::date,(p_payload->>'consent')::boolean);
  exception when unique_violation then raise exception 'OUTREACH_PHONE_EXISTS';end;
 elsif p_action in ('issue_link','revoke_link','remove_team') then
  select * into teammate from public.outreach_team where id=(p_payload->>'teamId')::uuid and cell_id=scope and is_active for update;
  if not found then raise exception 'Team member unavailable';end if;
  if p_action='issue_link' then
   new_hash:=p_payload->>'hash';if new_hash is null or new_hash!~'^[0-9a-f]{64}$' then raise exception 'Invalid access link';end if;
   update public.outreach_team set token_hash=new_hash,link_expires_at=now()+interval '7 days',created_by=auth.uid() where id=teammate.id;
  else
   update public.outreach_team set token_hash=null,link_expires_at=null,is_active=(p_action<>'remove_team') where id=teammate.id;
   if p_action='remove_team' then
    for person in select * from public.outreach_contacts where assignee_id=teammate.id and status not in ('completed','do_not_contact') for update loop
     update public.outreach_contacts set assignee_id=null,version=version+1 where id=person.id;
     insert into public.outreach_history(contact_id,actor,kind,message) values(person.id,who,'assignment','Unassigned after '||teammate.name||' was removed from the team.');
    end loop;
   end if;
  end if;
 elsif p_action='assign' then
  select * into person from public.outreach_contacts where id=(p_payload->>'contactId')::uuid and cell_id=scope for update;
  if not found then raise exception 'Contact unavailable';end if;
  expected:=(p_payload->>'version')::bigint;if expected is null or person.version<>expected then raise exception 'OUTREACH_CHANGED';end if;
  target:=nullif(p_payload->>'teamId','')::uuid;
  if target is not null then
   select * into teammate from public.outreach_team where id=target and cell_id=scope and is_active;
   if not found or not person.consent or person.status in ('completed','do_not_contact') then raise exception 'Assignment unavailable';end if;
  end if;
  if person.assignee_id is distinct from target then
   select name into old_name from public.outreach_team where id=person.assignee_id;
   update public.outreach_contacts set assignee_id=target,version=version+1 where id=person.id;
   insert into public.outreach_history(contact_id,actor,kind,message) values(person.id,who,'assignment',case when target is null then 'Unassigned from '||coalesce(old_name,'team')||'.' when old_name is null then 'Assigned to '||teammate.name||'.' else 'Reassigned from '||old_name||' to '||teammate.name||'.' end);
  end if;
 elsif p_action='distribute' then
  if not exists(select 1 from public.outreach_team where cell_id=scope and is_active) then raise exception 'Add your team first';end if;
  for person in select * from public.outreach_contacts where cell_id=scope and assignee_id is null and consent and status not in ('completed','do_not_contact') order by created_at,id for update loop
   select t.* into teammate from public.outreach_team t left join public.outreach_contacts c on c.assignee_id=t.id and c.consent and c.status not in ('completed','do_not_contact') where t.cell_id=scope and t.is_active group by t.id order by count(c.id),t.created_at,t.id limit 1;
   update public.outreach_contacts set assignee_id=teammate.id,version=version+1 where id=person.id;
   insert into public.outreach_history(contact_id,actor,kind,message) values(person.id,who,'assignment','Assigned to '||teammate.name||'.');
  end loop;
 elsif p_action='outcome' then
  perform private.outreach_outcome(scope,null,who,p_payload);
 else raise exception 'Unknown outreach action';end if;
 return private.outreach_snapshot(scope);
end;$$;

create function private.outreach_outcome(p_cell bigint,p_team uuid,p_actor text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare person public.outreach_contacts;stage text;note text;next_date date;expected bigint;entry uuid;stopping boolean;closing boolean;
begin
 select * into person from public.outreach_contacts where id=(p_payload->>'contactId')::uuid and cell_id=p_cell for update;
 if not found or (p_team is not null and person.assignee_id is distinct from p_team) then raise exception 'OUTREACH_ASSIGNMENT_CHANGED';end if;
 expected:=(p_payload->>'version')::bigint;entry:=(p_payload->>'entryId')::uuid;
 if entry is null then raise exception 'Invalid call record';end if;
 if exists(select 1 from public.outreach_history where id=entry and contact_id=person.id) then return;end if;
 if expected is null or person.version<>expected then raise exception 'OUTREACH_CHANGED';end if;
 stage:=p_payload->>'status';note:=coalesce(p_payload->>'notes','');stopping:=stage='do_not_contact';closing:=stage in ('do_not_contact','completed');
 if stage is null or stage not in ('no_answer','following_up','invited','attended','completed','do_not_contact') or length(note)>2000 then raise exception 'Check the call outcome';end if;
 if not stopping and (not person.consent or person.status='do_not_contact' or person.assignee_id is null) then raise exception 'This person must not be called';end if;
 next_date:=case when closing then null else nullif(p_payload->>'nextDue','')::date end;
 if not closing and (next_date is null or next_date<(now() at time zone 'Africa/Lusaka')::date) then raise exception 'Choose the next follow-up date, today or later';end if;
 update public.outreach_contacts set status=stage,consent=case when stopping then false else consent end,next_due=next_date,version=version+1 where id=person.id;
 insert into public.outreach_history(id,contact_id,actor,kind,message) values(entry,person.id,p_actor,case when stopping then 'status' else 'call' end,case stage when 'no_answer' then 'Called · no answer' when 'following_up' then 'Reached · following up' when 'invited' then 'Invited to a cell' when 'attended' then 'Attended' when 'completed' then 'Completed' else 'Do not contact' end||case when trim(note)='' then '' else ' — '||trim(note) end);
end;$$;

create function public.outreach_guest(p_token text,p_payload jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare teammate public.outreach_team;hashed text;scope bigint;
begin
 if p_token is null or p_token!~'^[0-9a-f]{64}$' then raise exception 'OUTREACH_LINK_UNAVAILABLE';end if;
 hashed:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 select cell_id into scope from public.outreach_team where token_hash=hashed;
 if scope is null then raise exception 'OUTREACH_LINK_UNAVAILABLE';end if;
 perform 1 from public.cells where id=scope for update;
 select t.* into teammate from public.outreach_team t join public.cells c on c.id=t.cell_id join public.zones z on z.id=c.zone_id join public.profiles p on p.user_id=t.created_by
 where t.token_hash=hashed and t.is_active and t.link_expires_at>now() and c.is_active and z.is_active and p.role='cell_leader' and p.cell_id=t.cell_id and not p.is_suspended for update of t;
 if not found then raise exception 'OUTREACH_LINK_UNAVAILABLE';end if;
 if p_payload is not null then perform private.outreach_outcome(teammate.cell_id,teammate.id,teammate.name,p_payload);end if;
 return private.outreach_snapshot(teammate.cell_id,teammate.id);
end;$$;

revoke all on function private.outreach_cell(),private.outreach_phone(text),private.outreach_snapshot(bigint,uuid),private.outreach_outcome(bigint,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.outreach_dashboard(),public.outreach_manage(text,jsonb),public.outreach_guest(text,jsonb) from public,anon,authenticated;
grant execute on function public.outreach_dashboard(),public.outreach_manage(text,jsonb) to authenticated;
grant execute on function public.outreach_guest(text,jsonb) to anon,authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261017000100',array[]::text[],'outreach_followup') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
