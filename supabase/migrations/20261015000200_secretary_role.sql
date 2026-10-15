-- Apply this migration before the next one, in its own transaction.
alter type public.app_role add value if not exists 'secretary';
