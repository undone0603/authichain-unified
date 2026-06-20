-- Migration: 00004_create_add_generation_credits_rpc
--
-- Creates the `add_generation_credits` Postgres function used by the Stripe
-- fulfillment path (src/lib/fulfillment.ts → /api/webhook) to grant a paying
-- customer the generation credits they bought.
--
-- WHY THIS MIGRATION EXISTS (revenue bug):
--   The fulfillment code has always called
--     supabase.rpc('add_generation_credits', { user_uuid, amount })
--   but the function was never created in the database. Because the call sits
--   inside a try/catch that logs failures as "non-fatal", every one-time pack
--   purchase (Starter $29 / Creator $99 / Studio $249) charged the customer and
--   then silently failed to grant any credits — a direct, invisible loss of
--   founder income. This migration makes the grant actually happen.
--
-- SEMANTICS:
--   The schema tracks usage as generations_used counting up toward
--   generations_limit (see 00002_create_deduct_generation_credit_rpc.sql, which
--   increments generations_used). "Adding credits" therefore means RAISING the
--   limit by `amount`, leaving the existing balance and usage intact so credits
--   stack across purchases.
--
-- Return values (JSON):
--   'ok'        Credits added. `limit` holds the new generations_limit.
--   'not_found' No profile row exists for this user_id. No change made.

CREATE OR REPLACE FUNCTION public.add_generation_credits(
  user_uuid UUID,
  amount    INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as the function owner (postgres), bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_limit INT;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RETURN json_build_object('status', 'noop', 'limit', 0);
  END IF;

  -- Lock the row so concurrent grants (e.g. webhook + success-page backstop)
  -- serialise rather than racing on a read-modify-write.
  SELECT generations_limit
    INTO v_limit
    FROM public.profiles
   WHERE user_id = user_uuid
     FOR UPDATE;  -- row-level lock

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found', 'limit', 0);
  END IF;

  UPDATE public.profiles
     SET generations_limit = generations_limit + amount,
         updated_at        = NOW()
   WHERE user_id = user_uuid;

  RETURN json_build_object(
    'status', 'ok',
    'limit',  COALESCE(v_limit, 0) + amount
  );
END;
$$;

-- Only the service role (server-side) may call this function.
REVOKE EXECUTE ON FUNCTION public.add_generation_credits(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_generation_credits(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_generation_credits(UUID, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.add_generation_credits(UUID, INT) TO service_role;
