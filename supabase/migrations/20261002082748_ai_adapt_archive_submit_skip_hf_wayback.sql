CREATE OR REPLACE FUNCTION public.ai_adapt_archive_submit(p_item_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  r public.ai_adapt_archive;
  v_out jsonb := '[]'::jsonb;
  v_skip jsonb := '[]'::jsonb;
  v_hf constant text := '^https?://(www\.)?huggingface\.co/';  -- Wayback returns 523 for huggingface.co (verified 2026-10-01)
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;

  if r.primary_url ~* v_hf then
    v_skip := v_skip || '["wayback_primary"]'::jsonb;
  elsif not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_primary'
                 and (completed_at is null or http_status between 200 and 299)) then
    insert into public.ai_adapt_archive_jobs(item_key, job_type, target_url) values (p_item_key, 'wayback_primary', r.primary_url);
    v_out := v_out || '["wayback_primary"]'::jsonb;
  end if;
  if r.code_url is not null then
    if r.code_url ~* v_hf then
      v_skip := v_skip || '["wayback_code"]'::jsonb;
    elsif not exists (select 1 from public.ai_adapt_archive_jobs where item_key = p_item_key and job_type = 'wayback_code'
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
  return jsonb_build_object('queued', v_out, 'skipped', v_skip);
end $function$;