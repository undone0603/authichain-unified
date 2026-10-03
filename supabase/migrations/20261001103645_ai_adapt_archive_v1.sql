-- AI Adapt archive ledger v1 (2026-10-01). Additive only: two new tables + three helper functions.
create table if not exists public.ai_adapt_archive (
  id bigserial primary key,
  item_key text not null unique,
  kind text not null check (kind in ('paper','code','model','dataset','space','page')),
  title text,
  primary_url text not null,
  code_url text,
  license text,
  license_sha256 text,
  pinned_ref text,
  first_reported_at timestamptz,
  archived_at timestamptz,
  receipts jsonb not null default '{}'::jsonb,
  availability text not null default 'available'
    check (availability in ('available','changed','gated','relicensed','removed','unknown')),
  last_checked_at timestamptz,
  change_log jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.ai_adapt_archive is 'AI Adapt: preserved releases (papers, code, models, pages) with pinned versions, archive receipts, and availability watch.';

create table if not exists public.ai_adapt_archive_jobs (
  id bigserial primary key,
  item_key text not null references public.ai_adapt_archive(item_key) on delete cascade,
  job_type text not null check (job_type in ('wayback_primary','wayback_code','swh_save','swh_status')),
  target_url text not null,
  net_request_id bigint,
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status int,
  result jsonb
);
create index if not exists ai_adapt_archive_jobs_open_idx on public.ai_adapt_archive_jobs (completed_at) where completed_at is null;

alter table public.ai_adapt_archive enable row level security;
alter table public.ai_adapt_archive_jobs enable row level security;

-- Submit archive requests for one item. Skips job types already pending or succeeded.
create or replace function public.ai_adapt_archive_submit(p_item_key text)
returns jsonb language plpgsql set search_path = public, net as $$
declare
  r public.ai_adapt_archive;
  v_id bigint;
  v_out jsonb := '{}'::jsonb;
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;

  if not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_primary'
                 and (completed_at is null or http_status between 200 and 299)) then
    v_id := net.http_get(url := 'https://web.archive.org/save/' || r.primary_url, timeout_milliseconds := 90000);
    insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url, net_request_id) values (p_item_key, 'wayback_primary', r.primary_url, v_id);
    v_out := v_out || jsonb_build_object('wayback_primary', v_id);
  end if;

  if r.code_url is not null then
    if not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_code'
                   and (completed_at is null or http_status between 200 and 299)) then
      v_id := net.http_get(url := 'https://web.archive.org/save/' || r.code_url, timeout_milliseconds := 90000);
      insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url, net_request_id) values (p_item_key, 'wayback_code', r.code_url, v_id);
      v_out := v_out || jsonb_build_object('wayback_code', v_id);
    end if;
    if r.code_url ~ '^https://(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)/'
       and not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'swh_save'
                       and (completed_at is null or http_status between 200 and 299)) then
      v_id := net.http_post(url := 'https://archive.softwareheritage.org/api/1/origin/save/git/url/' || rtrim(r.code_url, '/') || '/',
                            body := '{}'::jsonb, timeout_milliseconds := 30000);
      insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url, net_request_id) values (p_item_key, 'swh_save', r.code_url, v_id);
      v_out := v_out || jsonb_build_object('swh_save', v_id);
    end if;
  end if;
  return v_out;
end $$;

-- Queue a Software Heritage status check for every item whose save has not finished.
create or replace function public.ai_adapt_archive_swh_refresh()
returns int language plpgsql set search_path = public, net as $$
declare r record; v_id bigint; n int := 0;
begin
  for r in select a.item_key, a.code_url from public.ai_adapt_archive a
           where a.code_url ~ '^https://(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)/'
             and coalesce(a.receipts->'swh'->>'save_task_status','') not in ('succeeded','failed')
             and a.receipts ? 'swh'
             and not exists (select 1 from public.ai_adapt_archive_jobs j where j.item_key = a.item_key and j.job_type = 'swh_status' and j.completed_at is null)
  loop
    v_id := net.http_get(url := 'https://archive.softwareheritage.org/api/1/origin/save/git/url/' || rtrim(r.code_url, '/') || '/', timeout_milliseconds := 30000);
    insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url, net_request_id) values (r.item_key, 'swh_status', r.code_url, v_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Collect finished HTTP responses into job rows and archive receipts.
create or replace function public.ai_adapt_archive_collect()
returns jsonb language plpgsql set search_path = public, net as $$
declare
  j record;
  v_snap text;
  v_body jsonb;
  v_latest jsonb;
  n_done int := 0; n_ok int := 0; n_failed int := 0; n_pending int := 0;
begin
  for j in
    select jb.id, jb.item_key, jb.job_type, jb.submitted_at,
           resp.status_code, resp.timed_out, resp.error_msg, resp.headers, resp.content
    from public.ai_adapt_archive_jobs jb
    left join net._http_response resp on resp.id = jb.net_request_id
    where jb.completed_at is null
  loop
    if j.status_code is null and j.error_msg is null and coalesce(j.timed_out, false) = false then
      if j.submitted_at < now() - interval '5 hours' then
        update public.ai_adapt_archive_jobs set completed_at = now(), result = jsonb_build_object('error', 'response expired before collection') where id = j.id;
        n_failed := n_failed + 1; n_done := n_done + 1;
      else
        n_pending := n_pending + 1;
      end if;
      continue;
    end if;

    if j.status_code is null or j.status_code not between 200 and 299 then
      update public.ai_adapt_archive_jobs
         set completed_at = now(), http_status = j.status_code,
             result = jsonb_build_object('error', coalesce(j.error_msg, case when j.timed_out then 'timed out' else 'http ' || j.status_code end))
       where id = j.id;
      n_failed := n_failed + 1; n_done := n_done + 1;
      continue;
    end if;

    if j.job_type in ('wayback_primary', 'wayback_code') then
      v_snap := coalesce(j.headers->>'location', j.headers->>'Location', j.headers->>'content-location', j.headers->>'Content-Location',
                         substring(j.content from '(https://web\.archive\.org/web/[0-9]{14}/[^"''\s<>]+)'));
      if v_snap is not null and v_snap !~ '^https?://' then v_snap := 'https://web.archive.org' || v_snap; end if;
      update public.ai_adapt_archive_jobs set completed_at = now(), http_status = j.status_code, result = jsonb_build_object('snapshot_url', v_snap) where id = j.id;
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
               'save_request_status', v_latest->>'save_request_status',
               'save_task_status', v_latest->>'save_task_status',
               'snapshot_swhid', v_latest->>'snapshot_swhid',
               'visit_date', v_latest->>'visit_date',
               'checked_at', now())))
       where item_key = j.item_key;
      n_ok := n_ok + 1;
    end if;
    n_done := n_done + 1;
  end loop;
  return jsonb_build_object('completed', n_done, 'ok', n_ok, 'failed', n_failed, 'pending', n_pending);
end $$;

revoke all on function public.ai_adapt_archive_submit(text) from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_swh_refresh() from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_collect() from public, anon, authenticated;
