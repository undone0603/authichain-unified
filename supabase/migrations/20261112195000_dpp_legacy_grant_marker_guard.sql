-- Preserve credits already granted by the pre-atomic fulfillment path.
CREATE OR REPLACE FUNCTION public.grant_dpp_checkout_session(
  p_profile_id text,
  p_session_id text,
  p_brand text,
  p_stripe_customer_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_limit integer;
  v_used integer;
  v_new_limit integer;
  v_new_used integer;
  v_keep_subscription boolean;
  v_grant_key text;
BEGIN
  IF p_profile_id IS NULL OR btrim(p_profile_id) = ''
     OR p_session_id IS NULL OR btrim(p_session_id) = ''
     OR p_brand IS NULL OR btrim(p_brand) = '' THEN
    RAISE EXCEPTION 'invalid_dpp_grant_request';
  END IF;

  v_grant_key := 'grant:' || p_session_id;
  INSERT INTO public.founder_exit_side_effects (idempotency_key)
  VALUES (v_grant_key)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'already_granted');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id::text = p_profile_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dpp_grant_profile_not_found';
  END IF;

  IF v_profile.last_grant_session_id = p_session_id THEN
    RETURN jsonb_build_object('status', 'already_granted');
  END IF;

  v_limit := COALESCE(v_profile.generations_limit, 0);
  v_used := COALESCE(v_profile.generations_used, 0);
  v_keep_subscription :=
    COALESCE(v_profile.stripe_subscription_id, '') <> ''
    AND v_profile.subscription_status IN ('active', 'trialing', 'past_due');

  IF v_limit >= 999999 THEN
    v_new_limit := v_limit;
    v_new_used := v_used;
  ELSE
    v_new_limit := GREATEST(0, v_limit - v_used) + 50;
    v_new_used := 0;
  END IF;

  UPDATE public.profiles
  SET brand = p_brand,
      subscription_plan = CASE
        WHEN v_keep_subscription THEN subscription_plan
        ELSE 'dpp_readiness'
      END,
      subscription_status = CASE
        WHEN v_keep_subscription THEN subscription_status
        ELSE 'active'
      END,
      last_payment_at = now(),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      generations_limit = v_new_limit,
      generations_used = v_new_used,
      last_grant_session_id = p_session_id
  WHERE id = v_profile.id;

  RETURN jsonb_build_object(
    'status', 'granted',
    'profile_id', v_profile.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_dpp_checkout_session(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_dpp_checkout_session(text, text, text, text)
  TO service_role;
