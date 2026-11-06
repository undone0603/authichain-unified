-- v2 hardening (2026-10-14): liveness alarm that runs on pg_cron, outside the Claude scheduled-task fleet.
-- Why: 2026-10-09..13 every bot was silent (archive last ran 10-08) and nothing reported it.
create or replace function public.ai_adapt_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net'
set statement_timeout to '15s'
as $fn$
declare
  v_arch timestamptz; v_res timestamptz;
  v_stale text[] := '{}';
  v_from text; v_key text; v_req bigint;
  v_email text := 'not_configured';
begin
  select max(run_at) into v_arch from public.ops_bot_log where bot = 'ai-adapt-archive';
  select max(run_at) into v_res  from public.ops_bot_log where bot = 'ai-adapt-research';
  if v_arch is null or v_arch < now() - interval '36 hours' then
    v_stale := v_stale || ('ai-adapt-archive silent since ' || coalesce(to_char(v_arch at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), 'never'));
  end if;
  if v_res is null or v_res < now() - interval '36 hours' then
    v_stale := v_stale || ('ai-adapt-research silent since ' || coalesce(to_char(v_res at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), 'never'));
  end if;
  if cardinality(v_stale) = 0 then
    return jsonb_build_object('ok', true, 'archive_last', v_arch, 'research_last', v_res);
  end if;
  -- one alarm per 24h
  if exists (select 1 from public.ops_bot_log where bot = 'ai-adapt-heartbeat' and status = 'fail' and run_at > now() - interval '24 hours') then
    return jsonb_build_object('ok', false, 'deduped', true, 'stale', to_jsonb(v_stale));
  end if;

  -- Out-of-band email via Resend, only when both secrets exist (vault: resend_api_key + heartbeat_email_from).
  select decrypted_secret into v_key  from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'heartbeat_email_from';
  if v_key is not null and v_from is not null then
    v_req := net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', v_from,
        'to', jsonb_build_array('undone.k@gmail.com'),
        'subject', 'AI Adapt HEARTBEAT — bot silent ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD'),
        'text', array_to_string(v_stale, E'\n') || E'\n\nPinned copies stay safe, but new releases are not being archived or watched until the bots run again. Check the scheduled task "Bot: AI Adapt — archive & patch watch" and account usage limits.'));
    v_email := 'requested:' || v_req;
  end if;

  insert into public.ops_bot_log (bot, status, summary, actions_taken, decisions_needed, metrics)
  values ('ai-adapt-heartbeat', 'fail',
          'AI Adapt bot silent > 36h: ' || array_to_string(v_stale, '; '),
          jsonb_build_array('email ' || v_email),
          to_jsonb(v_stale),
          jsonb_build_object('archive_last', v_arch, 'research_last', v_res, 'email', v_email, 'net_request_id', v_req));
  return jsonb_build_object('ok', false, 'stale', to_jsonb(v_stale), 'email', v_email);
end $fn$;

revoke all on function public.ai_adapt_heartbeat() from public, anon, authenticated;

select cron.schedule('ai-adapt-heartbeat', '23 */6 * * *', 'select public.ai_adapt_heartbeat()');
