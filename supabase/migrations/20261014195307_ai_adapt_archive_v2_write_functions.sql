-- v2 hardening (2026-10-14): atomic per-row write functions for the AI Adapt archive bot.

create or replace function public.ai_adapt_archive_mark_checked(
  p_item_key text,
  p_patch jsonb default '{}'::jsonb,
  p_availability text default null,
  p_reason text default null)
returns jsonb
language plpgsql
set search_path to 'public'
set statement_timeout to '15s'
as $fn$
declare
  r public.ai_adapt_archive;
  k text; v jsonb;
  v_rec jsonb;
  v_changed boolean := false;
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key for update;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then raise exception 'p_patch must be a json object'; end if;

  v_rec := coalesce(r.receipts, '{}'::jsonb);
  for k, v in select * from jsonb_each(coalesce(p_patch, '{}'::jsonb)) loop
    if jsonb_typeof(v) = 'null' then
      v_rec := v_rec - k;                                   -- explicit null removes the key
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(v_rec->k) = 'object' then
      v_rec := jsonb_set(v_rec, array[k], (v_rec->k) || v); -- shallow merge one level down
    else
      v_rec := jsonb_set(v_rec, array[k], v, true);
    end if;
  end loop;

  if p_availability is not null and p_availability is distinct from r.availability then
    v_changed := true;
    update public.ai_adapt_archive
       set availability = p_availability,
           change_log = coalesce(change_log, '[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
             'at', now(), 'field', 'availability', 'from', r.availability, 'to', p_availability, 'reason', p_reason))),
           receipts = v_rec, last_checked_at = now()
     where item_key = p_item_key;
  else
    update public.ai_adapt_archive set receipts = v_rec, last_checked_at = now() where item_key = p_item_key;
  end if;

  return jsonb_build_object('item_key', p_item_key, 'availability', coalesce(p_availability, r.availability), 'changed', v_changed);
end $fn$;

create or replace function public.ai_adapt_archive_watch_result(
  p_item_key text, p_ok boolean, p_error text default null, p_url text default null)
returns jsonb
language plpgsql
set search_path to 'public'
set statement_timeout to '15s'
as $fn$
declare
  r public.ai_adapt_archive;
  v_prev int; v_new int; v_first text;
begin
  select * into r from public.ai_adapt_archive where item_key = p_item_key for update;
  if not found then raise exception 'unknown item_key %', p_item_key; end if;
  v_prev := coalesce((r.receipts->'watch'->>'unchecked_streak')::int, 0);
  if p_ok then
    v_new := 0;
    update public.ai_adapt_archive
       set receipts = jsonb_set(coalesce(receipts,'{}'::jsonb), '{watch}', jsonb_strip_nulls(jsonb_build_object(
             'unchecked_streak', 0, 'last_ok_at', now(), 'url', coalesce(p_url, r.receipts->'watch'->>'url')))),
           last_checked_at = now()
     where item_key = p_item_key;
  else
    v_new := v_prev + 1;
    v_first := coalesce(case when v_prev > 0 then r.receipts->'watch'->>'first_unchecked_at' end, now()::text);
    update public.ai_adapt_archive
       set receipts = jsonb_set(coalesce(receipts,'{}'::jsonb), '{watch}', jsonb_strip_nulls(jsonb_build_object(
             'unchecked_streak', v_new, 'first_unchecked_at', v_first,
             'last_error', left(coalesce(p_error, 'unreachable'), 200), 'last_failed_at', now(),
             'url', coalesce(p_url, r.receipts->'watch'->>'url')))),
           last_checked_at = now()
     where item_key = p_item_key;
  end if;
  return jsonb_build_object('item_key', p_item_key, 'streak', v_new, 'alert', v_new = 3, 'dead', v_new >= 7);
end $fn$;

revoke all on function public.ai_adapt_archive_mark_checked(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.ai_adapt_archive_watch_result(text, boolean, text, text) from public, anon, authenticated;
