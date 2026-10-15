begin;
alter table public.church_care_requests
  drop constraint if exists church_care_requests_kind_check,
  drop constraint if exists care_date_required,
  drop constraint if exists care_notice_required,
  drop constraint if exists care_announcement_request_kind,
  add column if not exists subject_name text not null default '' check(length(subject_name)<=160),
  add column if not exists announcement_requested boolean not null default false;
alter table public.church_care_requests
  add constraint church_care_requests_kind_check check(kind in ('visit','appointment','prayer','bereavement','newborn','hospital')),
  add constraint care_date_required check(kind not in ('visit','appointment') or requested_date is not null),
  add constraint care_notice_required check(kind not in ('bereavement','newborn','hospital') or (length(trim(subject_name))>0 and length(trim(message))>0)),
  add constraint care_announcement_request_kind check(not announcement_requested or kind in ('bereavement','newborn','hospital'));
-- Public users may submit requests; existing superadmin-only reading and updating remain in force.
-- An announcement request never publishes a row or grants permission to publish it.
insert into supabase_migrations.schema_migrations(version,statements,name)
values('20261015000100',array[]::text[],'member_care_notices') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
