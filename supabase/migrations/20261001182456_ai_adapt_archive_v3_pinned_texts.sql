-- v3: store license/card text captured at the pinned revision (for hosts the Wayback Machine cannot reach), and retry a one-off 404 once.
alter table public.ai_adapt_archive add column if not exists pinned_texts jsonb not null default '{}'::jsonb;
comment on column public.ai_adapt_archive.pinned_texts is 'Text files captured at pinned_ref, e.g. {"README.md": {"sha256": ..., "text": ...}, "LICENSE": {...}}. Used where Wayback cannot reach the host (huggingface.co returns 523).';

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
      if (j.attempts < 4 and (j.status_code is null or j.status_code = 429 or j.status_code >= 500))
         or (j.attempts < 2 and j.status_code = 404) then
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
revoke all on function public.ai_adapt_archive_collect() from public, anon, authenticated;

-- Re-queue the two one-off 404s.
update public.ai_adapt_archive_jobs
   set completed_at = null, net_request_id = null, submitted_at = null, next_attempt_at = now(),
       result = jsonb_build_object('last_error', 'http 404', 'attempts', attempts)
 where http_status = 404 and completed_at is not null and attempts < 2;
