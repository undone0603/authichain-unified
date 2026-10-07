-- Widen ops_bot_log.status to accept 'partial' (used by ai-adapt-research and ai-adapt-archive prompts). No existing rows change.
alter table public.ops_bot_log drop constraint ops_bot_log_status_check;
alter table public.ops_bot_log add constraint ops_bot_log_status_check check (status = any (array['ok'::text, 'warn'::text, 'partial'::text, 'fail'::text]));