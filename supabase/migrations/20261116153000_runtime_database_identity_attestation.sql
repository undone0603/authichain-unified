-- Read-only physical PostgreSQL cluster identity for protected runtime checks.
-- Supabase Auth can have zero rows in auth.instances; never use it as the pin.
-- The independent expected system identifier comes from a management-plane
-- read-only query, not from DATABASE_URL or the webhook REST URL.
CREATE OR REPLACE FUNCTION public.attest_runtime_database_identity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'system_identifier', system_identifier::text,
    'database_name', pg_catalog.current_database()
  )
  FROM pg_catalog.pg_control_system();
$$;

-- A public-schema RPC must not be callable by anon/authenticated/PUBLIC.
-- The owner of this migration must be authorized to query pg_control_system().
REVOKE ALL ON FUNCTION public.attest_runtime_database_identity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attest_runtime_database_identity()
  TO service_role;
