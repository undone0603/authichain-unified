-- Close anon/authenticated execute on the two self-serve writers.
-- authichain_api_resolve_key and growth_record_event stay anon-executable:
-- resolve_key only looks up a key the caller already holds, and the edge
-- growth recorder often has no service-role key.
--
-- Do not apply this until workers/authichain-api has SUPABASE_SERVICE_ROLE_KEY
-- bound. That worker prefers the service-role key for these two calls and
-- falls back to the anon key, so applying this first makes
-- POST /api/v1/keys/create and POST /api/v1/leads return 503.
--
-- The earlier self-serve migration grants execute to anon. This file is
-- later, so a normal migration run revokes that grant after it is created.
-- Both functions are already in the live database. The existence check only
-- keeps this file from failing on a database where they were never created.

do $$
begin
  if to_regprocedure('public.authichain_api_create_key(text, text, text)') is not null then
    revoke all on function public.authichain_api_create_key(text, text, text) from public;
    revoke all on function public.authichain_api_create_key(text, text, text) from anon;
    revoke all on function public.authichain_api_create_key(text, text, text) from authenticated;
    grant execute on function public.authichain_api_create_key(text, text, text) to service_role;
  end if;

  if to_regprocedure('public.authichain_api_capture_lead(text, text, text, text)') is not null then
    revoke all on function public.authichain_api_capture_lead(text, text, text, text) from public;
    revoke all on function public.authichain_api_capture_lead(text, text, text, text) from anon;
    revoke all on function public.authichain_api_capture_lead(text, text, text, text) from authenticated;
    grant execute on function public.authichain_api_capture_lead(text, text, text, text) to service_role;
  end if;
end $$;
