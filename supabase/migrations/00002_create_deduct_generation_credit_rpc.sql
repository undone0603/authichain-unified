-- Migration: 00002_create_deduct_generation_credit_rpc
--
-- Creates the `deduct_generation_credit` Postgres function used by
-- src/lib/business-tier.ts to atomically check-and-decrement a user's
-- generation credit in a single round-trip.
--
-- Why an RPC instead of read-then-update in application code?
-- The read-then-update pattern in the previous version had a TOCTOU
-- (time-of-check / time-of-use) race condition: two concurrent requests
-- could both read generations_used = 4 (limit = 5), both pass the check,
-- and both increment — resulting in generations_used = 6 (one over the
-- limit). The RPC holds a row-level lock for the duration of the update
-- so concurrent calls are serialised at the database level.
--
-- Return values:
--   'ok'            Credit deducted successfully. `remaining` holds credits left.
--   'limit_reached' User is already at or over their limit. No deduction made.
--   'unlimited'     User is on business/enterprise tier. No deduction made.
--   'not_found'     No profile row exists for this user_id.

CREATE OR REPLACE FUNCTION public.deduct_generation_credit(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as the function owner (postgres), bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_used      INT;
  v_limit     INT;
  v_tier      TEXT;
  v_remaining INT;
BEGIN
  -- Lock the row for the duration of this transaction so concurrent calls
  -- queue behind each other rather than racing.
  SELECT generations_used, generations_limit, tier
    INTO v_used, v_limit, v_tier
    FROM public.profiles
   WHERE user_id = p_user_id
     FOR UPDATE;  -- row-level lock

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found', 'remaining', 0);
  END IF;

  -- Business / enterprise tier = unlimited generations
  IF v_tier IN ('enterprise', 'business') OR v_limit >= 999999 THEN
    RETURN json_build_object('status', 'unlimited', 'remaining', 2147483647);
  END IF;

  -- Limit already reached — do NOT deduct
  IF v_used >= v_limit THEN
    RETURN json_build_object('status', 'limit_reached', 'remaining', 0);
  END IF;

  -- Atomic increment and return remaining credits
  UPDATE public.profiles
     SET generations_used = v_used + 1
   WHERE user_id = p_user_id;

  v_remaining := v_limit - (v_used + 1);

  RETURN json_build_object(
    'status',    'ok',
    'remaining', GREATEST(0, v_remaining)
  );
END;
$$;

-- Only the service role (server-side) may call this function.
-- Authenticated users and anon callers are explicitly denied.
REVOKE EXECUTE ON FUNCTION public.deduct_generation_credit(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_generation_credit(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_generation_credit(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.deduct_generation_credit(UUID) TO service_role;
