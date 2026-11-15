-- Draft-only: do not deploy until both Stripe webhook rails use this RPC and
-- disposable-Postgres crash/concurrency acceptance has passed.
-- Single PostgREST RPC transaction atomically records one receipt and adds one pack.
-- Mirrors grant_dpp_checkout_session, but limits the SKU to known QRON packs.
CREATE OR REPLACE FUNCTION public.grant_stripe_pack_session(
  p_profile_id text,
  p_session_id text,
  p_plan text,
  p_stripe_customer_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_existing_profile text;
  v_receipt_key text;
  v_credits integer;
  v_limit integer;
  v_used integer;
  v_keep_subscription boolean;
BEGIN
  IF p_profile_id IS NULL OR btrim(p_profile_id) = ''
     OR p_session_id IS NULL OR btrim(p_session_id) = ''
     OR length(p_session_id) > 255 THEN
    RAISE EXCEPTION 'invalid_pack_grant_request';
  END IF;

  -- Never accept a credit amount from an untrusted caller.
  -- The verified Stripe price/amount mapping must happen before invoking RPC.
  v_credits := CASE p_plan
    WHEN 'starter' THEN 100
    WHEN 'creator' THEN 500
    ELSE NULL
  END;
  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'unsupported_pack_plan';
  END IF;

  -- The row lock serializes grants for the same profile and protects usage
  -- spending from a lost-update only if spending also locks this profile row.
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id::text = p_profile_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack_grant_profile_not_found';
  END IF;

  v_receipt_key := 'grant:' || p_session_id;

  -- Backfill a pre-RPC session stamp without granting again.
  -- A concurrent replay waits for the row lock, then sees the new receipt.
  IF v_profile.last_grant_session_id = p_session_id THEN
    INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
    VALUES (v_receipt_key, p_profile_id)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN jsonb_build_object(
      'status', 'already_granted', 'profile_id', p_profile_id
    );
  END IF;

  INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
  VALUES (v_receipt_key, p_profile_id)
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT profile_id INTO v_existing_profile
    FROM public.founder_exit_side_effects
    WHERE idempotency_key = v_receipt_key;
    IF v_existing_profile IS NOT NULL AND v_existing_profile <> p_profile_id THEN
      RAISE EXCEPTION 'pack_receipt_profile_mismatch';
    END IF;
    RETURN jsonb_build_object(
      'status', 'already_granted', 'profile_id', p_profile_id
    );
  END IF;

  v_limit := COALESCE(v_profile.generations_limit, 0);
  v_used := COALESCE(v_profile.generations_used, 0);
  v_keep_subscription :=
    COALESCE(v_profile.stripe_subscription_id, '') <> ''
    AND v_profile.subscription_status IN ('active', 'trialing', 'past_due');

  UPDATE public.profiles
  SET brand = 'qron',
      subscription_plan = CASE
        WHEN v_keep_subscription THEN subscription_plan ELSE p_plan
      END,
      subscription_status = CASE
        WHEN v_keep_subscription THEN subscription_status ELSE 'active'
      END,
      last_payment_at = now(),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      generations_limit = CASE
        WHEN v_limit >= 999999 THEN v_limit
        ELSE GREATEST(0, v_limit - v_used) + v_credits
      END,
      generations_used = CASE
        WHEN v_limit >= 999999 THEN v_used ELSE 0
      END,
      last_grant_session_id = p_session_id
  WHERE id = v_profile.id;

  -- An exception rolls back BOTH the receipt and profile update.
  RETURN jsonb_build_object(
    'status', 'granted', 'profile_id', p_profile_id,
    'plan', p_plan, 'credits', v_credits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_stripe_pack_session(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_stripe_pack_session(text, text, text, text)
  TO service_role;
