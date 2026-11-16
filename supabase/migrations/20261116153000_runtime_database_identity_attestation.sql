-- Read-only identity probe used solely by the protected runtime endpoint.
-- The Auth instance UUID is unique to the live Supabase database. It is
-- independently pinned by the operator and never taken from DATABASE_URL.
-- This function does not modify tables or grant access to auth.instances.
CREATE OR REPLACE FUNCTION public.attest_runtime_database_identity()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT id FROM auth.instances ORDER BY id LIMIT 1;
$$;

-- In Supabase, a new public function may be executable by PUBLIC by default.
-- Make the narrow service-role-only API explicit; the DB function owner can
-- still execute it through the direct PostgreSQL path.
REVOKE ALL ON FUNCTION public.attest_runtime_database_identity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attest_runtime_database_identity()
  TO service_role;
