begin;
create function private.prepare_ministry_request() returns trigger language plpgsql security definer set search_path='' as $$
declare digits text;rules public.ministry_youth_rules;
begin
 digits:=regexp_replace(new.phone,'[^0-9]','','g');
 if length(digits)=10 and left(digits,1)='0' then digits:='260'||substr(digits,2);elsif left(digits,2)='00' then digits:=substr(digits,3);end if;
 if digits !~ '^[1-9][0-9]{7,14}$' then raise exception 'Enter a complete WhatsApp phone number';end if;
 new.phone:='+'||digits;
 perform pg_advisory_xact_lock(hashtextextended('ministry:'||digits,0));
 if (select count(*) from public.ministry_join_requests where phone=new.phone and created_at>now()-interval '1 hour')>=3 then raise exception 'Please try again later';end if;
 if exists(select 1 from public.ministry_join_requests where phone=new.phone and ministry=new.ministry and status in ('pending','contacted')) then raise exception 'A request for this ministry is already waiting for review';end if;
 if new.ministry='youth' then
  select * into rules from public.ministry_youth_rules where id;
  new.assigned_group:=case when new.age between rules.early_min and rules.early_max then 'early-youth' when new.age between rules.adult_min and rules.adult_max then 'young-adults' else null end;
 else new.age:=null;new.assigned_group:=new.ministry;end if;
 new.consent_recorded_at:=case when new.whatsapp_consent then now() else null end;
 new.review_notes:='';
 return new;
end;$$;
revoke all on function private.prepare_ministry_request() from public,anon,authenticated;
create trigger ministry_request_prepare before insert on public.ministry_join_requests for each row execute function private.prepare_ministry_request();
grant insert on public.ministry_join_requests to anon,authenticated;
grant update(status,reviewed_at,reviewed_by) on public.ministry_join_requests to authenticated;
insert into supabase_migrations.schema_migrations(version,statements,name) values('20261016000200',array[]::text[],'ministry_legacy_form_compatibility') on conflict(version) do nothing;
notify pgrst,'reload schema';commit;
