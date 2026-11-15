-- Atomic and replay-safe QRON Starter/Creator pack fulfillment.
-- This migration must be applied by a separately authorized protected Supabase release.
-- PostgreSQL ensures the receipt and entitlement change commit or roll back together.
CREATE OR REPLACE FUNCTION public.grant_qron_pack_checkout_session(
  p_profile_id text,
  p_session_id text,
  p_plan text,
  p_credits integer,
  p_stripe_customer_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_receipt_profile text;
  v_key text;
  v_credits integer;
  v_limit integer;
  v_used integer;
  v_keep_subscription boolean;
BEGIN
  IF p_profile_id IS NULL OR btrim(p_profile_id) = ''
    OR p_session_id IS NULL OR btrim(p_session_id) = ''
    OR length(p_session_id) > 255
    OR p_session_id !~ '^cs_[A-Za-z0-9_]+$'
  THEN
    RAISE EXCEPTION 'invalid_pack_grant_identity';
  END IF;
  -- Never trust a webhook-supplied credit amount independent of the catalogue.
  IF p_plan = 'starter' THEN
    v_credits := 100;
  ELSIF p_plan = 'creator' THEN
    v_credits := 500;
  ELSE
    RAISE EXCEPTION 'unsupported_pack_grant_plan';
  END IF;
  IF p_credits IS DISTINCT FROM v_credits THEN
    RAISE EXCEPTION 'invalid_pack_grant_credits';
  END IF;

  -- Lock the profile before reading the receipt. Cross-rail callers serialize.
  SELECT * INTO v_profile
    FROM public.profiles
    WHERE id::text = p_profile_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack_grant_profile_not_found';
  END IF;

  v_key := 'grant:' || p_session_id;
  SELECT profile_id INTO v_receipt_profile
    FROM public.founder_exit_side_effects
    WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_receipt_profile IS NOT NULL AND v_receipt_profile <> p_profile_id THEN
      RAISE EXCEPTION 'pack_grant_receipt_profile_mismatch';
    END IF;
    RETURN jsonb_build_object('status', 'already_granted', 'profile_id', p_profile_id);
  END IF;

  -- A pre-migration grant might have no receipt. Only the latest marker can be recovered.
  IF v_profile.last_grant_session_id = p_session_id THEN
    INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
      VALUES (v_key, p_profile_id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('status', 'already_granted', 'profile_id', p_profile_id);
  END IF;

  -- The unique claim and credit change happen in ONE database transaction.
  INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
    VALUES (v_key, p_profile_id)
    ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT profile_id INTO v_receipt_profile
      FROM public.founder_exit_side_effects WHERE idempotency_key = v_key;
    IF v_receipt_profile IS NOT NULL AND v_receipt_profile <> p_profile_id THEN
      RAISE EXCEPTION 'pack_grant_receipt_profile_mismatch';
    END IF;
    RETURN jsonb_build_object('status', 'already_granted', 'profile_id', p_profile_id);
  END IF;

  v_limit := COALESCE(v_profile.generations_limit, 0);
  v_used := COALESCE(v_profile.generations_used, 0);
  v_keep_subscription :=
    COALESCE(v_profile.stripe_subscription_id, '') <> ''
    AND v_profile.subscription_status IN ('active', 'trialing', 'past_due');

  UPDATE public.profiles
     SET brand = 'qron',
         subscription_plan = CASE WHEN v_keep_subscription
           THEN subscription_plan ELSE p_plan END,
         subscription_status = CASE WHEN v_keep_subscription
           THEN subscription_status ELSE 'active' END,
         last_payment_at = now(),
         stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
         generations_limit = CASE WHEN v_limit >= 999999 THEN v_limit
           ELSE GREATEST(0, v_limit - v_used) + v_credits END,
         generations_used = CASE WHEN v_limit >= 999999 THEN v_used ELSE 0 END,
         last_grant_session_id = p_session_id
   WHERE id = v_profile.id;

  RETURN jsonb_build_object('status', 'granted', 'profile_id', p_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_qron_pack_checkout_session(text, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_qron_pack_checkout_session(text, text, text, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.grant_qron_pack_checkout_session(text, text, text, integer, text)
  IS 'Atomic Starter/Creator checkout receipt and entitlement grant; service-role only.';
