-- v2 hardening (2026-10-14): submit() now (a) retries failed Software Heritage saves once per 20h, max 3,
-- and (b) stops re-queuing Wayback captures for a host whose unreachable streak is >= 7.
create or replace function public.ai_adapt_archive_submit(p_item_key text)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  r public.ai_adapt_archive;
  v_out jsonb := '[]'::jsonb;
  v_skip jsonb := '[]'::jsonb;
  v_hf constant text := '^https?://(www\.)?huggingface\.co/';  -- Wayback returns 523 for huggingface.co (verified 2026-10-01)
  v_known constant text := '^https?://(www\.)?(github\.com|gitlab\.com|huggingface\.co|arxiv\.org)/';
  v_dead boolean;
  v_dead_url text;
  v_retries int;
  v_last timestamptz;
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;

  v_dead := coalesce((r.receipts->'watch'->>'unchecked_streak')::int, 0) >= 7;
  if v_dead then
    v_dead_url := coalesce(r.receipts->'watch'->>'url',
                           case when r.code_url is not null and r.code_url !~* v_known then r.code_url end,
                           case when r.primary_url !~* v_known then r.primary_url end);
  end if;

  if r.primary_url ~* v_hf then
    v_skip := v_skip || '["wayback_primary"]'::jsonb;
  elsif v_dead and r.primary_url = v_dead_url then
    v_skip := v_skip || '["wayback_primary:dead_host"]'::jsonb;
  elsif not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_primary'
                 and (completed_at is null or http_status between 200 and 299)) then
    insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'wayback_primary', r.primary_url);
    v_out := v_out || '["wayback_primary"]'::jsonb;
  end if;

  if r.code_url is not null then
    if r.code_url ~* v_hf then
      v_skip := v_skip || '["wayback_code"]'::jsonb;
    elsif v_dead and r.code_url = v_dead_url then
      v_skip := v_skip || '["wayback_code:dead_host"]'::jsonb;
    elsif not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_code'
                   and (completed_at is null or http_status between 200 and 299)) then
      insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'wayback_code', r.code_url);
      v_out := v_out || '["wayback_code"]'::jsonb;
    end if;

    if r.code_url ~ '^https://(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)/' then
      if not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'swh_save'
                     and (completed_at is null or http_status between 200 and 299)) then
        insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'swh_save', r.code_url);
        v_out := v_out || '["swh_save"]'::jsonb;
      elsif r.receipts->'swh'->>'save_task_status' = 'failed'
            and not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'swh_save' and completed_at is null) then
        v_retries := coalesce((r.receipts->'swh_retry'->>'count')::int, 0);
        v_last := (r.receipts->'swh_retry'->>'last_at')::timestamptz;
        if v_retries >= 3 then
          v_skip := v_skip || '["swh_retry_exhausted"]'::jsonb;
        elsif v_last is not null and v_last > now() - interval '20 hours' then
          v_skip := v_skip || '["swh_retry_wait"]'::jsonb;
        else
          insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'swh_save', r.code_url);
          -- counter lives at receipts.swh_retry (top level) because collect() replaces receipts.swh wholesale
          update public.ai_adapt_archive
             set receipts = receipts || jsonb_build_object('swh_retry', jsonb_build_object('count', v_retries + 1, 'last_at', now()))
           where item_key = p_item_key;
          v_out := v_out || jsonb_build_array('swh_save_retry_' || (v_retries + 1));
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('queued', v_out, 'skipped', v_skip);
end $function$;
