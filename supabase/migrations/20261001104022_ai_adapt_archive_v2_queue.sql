-- v2: rate-limited queue + retry with backoff, drained by pg_cron. Additive.
alter table public.ai_adapt_archive_jobs add column if not exists attempts int not null default 0;
alter table public.ai_adapt_archive_jobs add column if not exists next_attempt_at timestamptz not null default now();
alter table public.ai_adapt_archive_jobs alter column submitted_at drop not null;
alter table public.ai_adapt_archive_jobs alter column submitted_at drop default;
update public.ai_adapt_archive_jobs set attempts = 1 where attempts = 0 and net_request_id is not null;

-- submit now only QUEUES jobs; the pump fires them at a polite rate.
create or replace function public.ai_adapt_archive_submit(p_item_key text)
returns jsonb language plpgsql set search_path = public as $$
declare
  r public.ai_adapt_archive;
  v_out jsonb := '[]'::jsonb;
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;

  if not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_primary'
                 and (completed_at is null or http_status between 200 and 299)) then
    insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'wayback_primary', r.primary_url);
    v_out := v_out || '["wayback_primary"]'::jsonb;
  end if;
  if r.code_url is not null then
    if not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_code'
                   and (completed_at is null or http_status between 200 and 299)) then
      insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'wayback_code', r.code_url);
      v_out := v_out || '["wayback_code"]'::jsonb;
    end if;
    if r.code_url ~ '^https://(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)/'
       and not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'swh_save'
                       and (completed_at is null or http_status between 200 and 299)) then
      insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'swh_save', r.code_url);
      v_out := v_out || '["swh_save"]'::jsonb;
    end if;
  end if;
  return jsonb_build_object('queued', v_out);
end $$;

-- Queue a Software Heritage status check for every item whose save has not reached a final state.
create or replace function public.ai_adapt_archive_swh_refresh()
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url)
  select a.item_key, 'swh_status', a.code_url
  from public.ai_adapt_archive a
  where a.receipts ? 'swh'
    and coalesce(a.receipts->'swh'->>'save_task_status', '') not in ('succeeded', 'failed')
    and not exists (select 1 from public.ai_adapt_archive_jobs j
                    where j.item_key = a.item_key and j.job_type = 'swh_status' and j.completed_at is null);
  get diagnostics n = row_count;
  return n;
end $$;

-- Collect responses for SENT jobs. Transient failures (429, 5xx, timeout, no response) are re-queued with backoff, max 4 attempts.
create or replace function public.ai_adapt_archive_collect()
returns jsonb language plpgsql set search_path = public, net as $$
declare
  j record;
  v_snap text;
  v_body jsonb;
  v_latest jsonb;
  v_err text;
  n_ok int := 0; n_failed int := 0; n_retry int := 0; n_pending int := 0;
begin
  for j in
    select jb.id, jb.item_key, jb.job_type, jb.submitted_at, jb.attempts,
           resp.status_code, resp.timed_out, resp.error_msg, resp.headers, resp.content
    from public.ai_adapt_archive_jobs jb
    left join net._http_response resp on resp.id = jb.net_request_id
    where jb.completed_at is null and jb.net_request_id is not null
  loop
    -- no response yet
    if j.status_code is null and j.error_msg is null and coalesce(j.timed_out, false) = false then
      if j.submitted_at > now() - interval '5 hours' then
        n_pending := n_pending + 1;
        continue;
      end if;
      v_err := 'no response within 5 hours';
    elsif j.status_code is null or j.status_code not between 200 and 299 then
      v_err := coalesce(j.error_msg, case when j.timed_out then 'timed out' else 'http ' || j.status_code end);
    else
      v_err := null;
    end if;

    if v_err is not null then
      if j.attempts < 4 and (j.status_code is null or j.status_code = 429 or j.status_code >= 500) then
        update public.ai_adapt_archive_jobs
           set net_request_id = null, submitted_at = null, http_status = j.status_code,
               result = jsonb_build_object('last_error', v_err, 'attempts', j.attempts),
               next_attempt_at = now() + interval '5 minutes' * power(2, j.attempts)
         where id = j.id;
        n_retry := n_retry + 1;
      else
        update public.ai_adapt_archive_jobs
           set completed_at = now(), http_status = j.status_code,
               result = jsonb_build_object('error', v_err, 'attempts', j.attempts)
         where id = j.id;
        n_failed := n_failed + 1;
      end if;
      continue;
    end if;

    if j.job_type in ('wayback_primary', 'wayback_code') then
      v_snap := coalesce(j.headers->>'location', j.headers->>'Location', j.headers->>'content-location', j.headers->>'Content-Location',
                         substring(j.content from '(https://web\.archive\.org/web/[0-9]{14}/[^"''\s<>]+)'));
      if v_snap is not null and v_snap !~ '^https?://' then v_snap := 'https://web.archive.org' || v_snap; end if;
      update public.ai_adapt_archive_jobs set completed_at = now(), http_status = j.status_code,
             result = jsonb_build_object('snapshot_url', v_snap) where id = j.id;
      if v_snap is not null then
        update public.ai_adapt_archive
           set receipts = receipts || jsonb_build_object(j.job_type, jsonb_build_object('snapshot_url', v_snap, 'captured_at', now())),
               archived_at = case when j.job_type = 'wayback_primary' then coalesce(archived_at, now()) else archived_at end
         where item_key = j.item_key;
        n_ok := n_ok + 1;
      else
        n_failed := n_failed + 1;
      end if;
    else
      begin
        v_body := j.content::jsonb;
      exception when others then
        v_body := jsonb_build_object('unparsed', left(j.content, 300));
      end;
      if jsonb_typeof(v_body) = 'array' then
        select e into v_latest from jsonb_array_elements(v_body) e order by e->>'save_request_date' desc limit 1;
      else
        v_latest := v_body;
      end if;
      update public.ai_adapt_archive_jobs set completed_at = now(), http_status = j.status_code, result = v_latest where id = j.id;
      update public.ai_adapt_archive
         set receipts = receipts || jsonb_build_object('swh', jsonb_strip_nulls(jsonb_build_object(
               'request_id', v_latest->'id',
               'request_url', v_latest->>'request_url',
               'save_request_status', v_latest->>'save_request_status',
               'save_task_status', v_latest->>'save_task_status',
               'snapshot_swhid', v_latest->>'snapshot_swhid',
               'visit_date', v_latest->>'visit_date',
               'checked_at', now())))
       where item_key = j.item_key;
      n_ok := n_ok + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', n_ok, 'failed', n_failed, 'retry_queued', n_retry, 'in_flight', n_pending);
end $$;

-- Pump: collect, then fire queued jobs. Wayback: at most 2 in flight. Software Heritage: up to 5 per tick.
create or replace function public.ai_adapt_archive_pump()
returns jsonb language plpgsql set search_path = public, net as $$
declare
  v_c jsonb;
  j record;
  v_id bigint;
  v_inflight int;
  n_fired int := 0;
begin
  v_c := public.ai_adapt_archive_collect();

  select count(*) into v_inflight from public.ai_adapt_archive_jobs
   where completed_at is null and net_request_id is not null and job_type in ('wayback_primary', 'wayback_code');

  for j in select id, target_url from public.ai_adapt_archive_jobs
           where completed_at is null and net_request_id is null and next_attempt_at <= now()
             and job_type in ('wayback_primary', 'wayback_code')
           order by next_attempt_at, id
           limit greatest(0, 2 - v_inflight)
  loop
    v_id := net.http_get(url := 'https://web.archive.org/save/' || j.target_url, timeout_milliseconds := 90000);
    update public.ai_adapt_archive_jobs set net_request_id = v_id, submitted_at = now(), attempts = attempts + 1 where id = j.id;
    n_fired := n_fired + 1;
  end loop;

  for j in select id, job_type, target_url from public.ai_adapt_archive_jobs
           where completed_at is null and net_request_id is null and next_attempt_at <= now()
             and job_type in ('swh_save', 'swh_status')
           order by next_attempt_at, id
           limit 5
  loop
    if j.job_type = 'swh_save' then
      v_id := net.http_post(url := 'https://archive.softwareheritage.org/api/1/origin/save/git/url/' || rtrim(j.target_url, '/') || '/',
                            body := '{}'::jsonb, timeout_milliseconds := 30000);
    else
      v_id := net.http_get(url := 'https://archive.softwareheritage.org/api/1/origin/save/git/url/' || rtrim(j.target_url, '/') || '/',
                           timeout_milliseconds := 30000);
    end if;
    update public.ai_adapt_archive_jobs set net_request_id = v_id, submitted_at = now(), attempts = attempts + 1 where id = j.id;
    n_fired := n_fired + 1;
  end loop;

  return v_c || jsonb_build_object('fired', n_fired);
end $$;

revoke all on function public.ai_adapt_archive_submit(text) from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_swh_refresh() from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_collect() from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_pump() from public, anon, authenticated;

-- Re-queue the four captures that hit Wayback's rate limit in the first batch.
update public.ai_adapt_archive_jobs
   set completed_at = null, net_request_id = null, submitted_at = null, http_status = null,
       result = jsonb_build_object('last_error', 'http 429', 'attempts', 1), next_attempt_at = now()
 where http_status = 429;

select cron.schedule('ai-adapt-archive-pump', '*/2 * * * *', 'select public.ai_adapt_archive_pump()');
select cron.schedule('ai-adapt-archive-swh-refresh', '7 * * * *', 'select public.ai_adapt_archive_swh_refresh()');
