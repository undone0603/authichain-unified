-- #1882: atomic free-tier reservation for POST /api/x402.
-- Grants one free slot only while fewer than p_limit x402_free rows exist for
-- p_key since p_since. Check + insert run under a per-key transaction advisory
-- lock, so concurrent callers cannot exceed the cap.
-- NOTE: automation_logs.created_at is timestamp WITHOUT time zone, so the
-- created_at >= p_since comparison casts p_since using the session TimeZone and
-- assumes it is UTC (the Supabase default). A non-UTC session would shift the
-- daily window.
-- Rollback: DROP FUNCTION IF EXISTS public.x402_claim_free_call(text, timestamptz, integer);
CREATE OR REPLACE FUNCTION public.x402_claim_free_call(
  p_key text,
  p_since timestamptz,
  p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_used integer;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_limit IS NULL OR p_limit <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'used', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('x402_free:' || p_key, 0));

  SELECT count(*)::integer INTO v_used
  FROM public.automation_logs
  WHERE workflow_name = 'x402_free'
    AND payload = p_key
    AND created_at >= p_since;

  IF v_used >= p_limit THEN
    RETURN jsonb_build_object('granted', false, 'used', v_used);
  END IF;

  INSERT INTO public.automation_logs (workflow_name, trigger_type, status, payload)
  VALUES ('x402_free', 'event', 'success', p_key);

  RETURN jsonb_build_object('granted', true, 'used', v_used + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.x402_claim_free_call(text, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.x402_claim_free_call(text, timestamptz, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.x402_claim_free_call(text, timestamptz, integer) TO service_role;
