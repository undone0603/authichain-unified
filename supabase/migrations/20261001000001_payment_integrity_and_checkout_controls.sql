-- Durable, idempotent commission accounting, payout claims, and checkout
-- request controls. All externally-called functions are service-role only.

CREATE TABLE IF NOT EXISTS public.affiliate_commission_events (
  event_id text PRIMARY KEY,
  affiliate_id uuid NOT NULL,
  gross_cents bigint NOT NULL CHECK (gross_cents > 0),
  commission_usd numeric(12,2) NOT NULL CHECK (commission_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_commission_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events TO service_role;
REVOKE ALL ON TABLE public.affiliate_commission_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accrue_affiliate_commission(
  p_event_id text,
  p_affiliate_code text,
  p_amount_cents bigint,
  p_conversion boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aff public.affiliates%ROWTYPE;
  v_commission numeric(12,2);
  v_inserted_event text;
BEGIN
  IF p_event_id IS NULL OR p_event_id = '' OR p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid_input');
  END IF;

  SELECT * INTO v_aff
  FROM public.affiliates
  WHERE affiliatecode = p_affiliate_code
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'unknown_code');
  END IF;
  IF v_aff.status <> 'active' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'inactive');
  END IF;

  v_commission := round((p_amount_cents::numeric / 100) *
    coalesce(v_aff.commission_rate, 0.20), 2);
  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'zero_commission');
  END IF;

  INSERT INTO public.affiliate_commission_events
    (event_id, affiliate_id, gross_cents, commission_usd)
  VALUES
    (p_event_id, v_aff.id, p_amount_cents, v_commission)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id INTO v_inserted_event;

  IF v_inserted_event IS NULL THEN
    RETURN jsonb_build_object(
      'credited', true,
      'duplicate', true,
      'affiliate_id', v_aff.id,
      'commission', v_commission
    );
  END IF;

  UPDATE public.affiliates
  SET pending_payout = coalesce(pending_payout, 0) + v_commission,
      total_referrals = CASE WHEN p_conversion
        THEN coalesce(total_referrals, 0) + 1 ELSE total_referrals END,
      total_conversions = CASE WHEN p_conversion
        THEN coalesce(total_conversions, 0) + 1 ELSE total_conversions END,
      updated_at = now()
  WHERE id = v_aff.id;

  RETURN jsonb_build_object(
    'credited', true,
    'duplicate', false,
    'affiliate_id', v_aff.id,
    'commission', v_commission
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_affiliate_commission(text, text, bigint, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accrue_affiliate_commission(text, text, bigint, boolean)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.affiliate_payout_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  affiliate_user_id text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 100),
  destination_account text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  stripe_transfer_id text UNIQUE,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'paid')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payout_one_processing_per_affiliate
  ON public.affiliate_payout_claims (affiliate_id)
  WHERE status = 'processing';

ALTER TABLE public.affiliate_payout_claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payout_claims TO service_role;
REVOKE ALL ON TABLE public.affiliate_payout_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_affiliate_payout(
  p_affiliate_id uuid,
  p_destination_account text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aff public.affiliates%ROWTYPE;
  v_claim public.affiliate_payout_claims%ROWTYPE;
  v_cents bigint;
  v_claim_id uuid;
BEGIN
  SELECT * INTO v_aff
  FROM public.affiliates
  WHERE id = p_affiliate_id
  FOR UPDATE;
  IF NOT FOUND OR v_aff.status <> 'active' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'affiliate_unavailable');
  END IF;

  SELECT * INTO v_claim
  FROM public.affiliate_payout_claims
  WHERE affiliate_id = p_affiliate_id AND status = 'processing'
  FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', true,
      'id', v_claim.id,
      'affiliate_user_id', v_claim.affiliate_user_id,
      'amount_cents', v_claim.amount_cents,
      'destination_account', v_claim.destination_account,
      'idempotency_key', v_claim.idempotency_key
    );
  END IF;

  v_cents := round(coalesce(v_aff.pending_payout, 0) * 100)::bigint;
  IF v_cents < 100 OR p_destination_account IS NULL OR p_destination_account = '' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'below_minimum_or_unconnected');
  END IF;

  v_claim_id := gen_random_uuid();
  INSERT INTO public.affiliate_payout_claims
    (id, affiliate_id, affiliate_user_id, amount_cents, destination_account, idempotency_key)
  VALUES
    (v_claim_id, p_affiliate_id, v_aff.user_id::text, v_cents,
     p_destination_account, 'affpayout_' || v_claim_id::text)
  RETURNING * INTO v_claim;

  UPDATE public.affiliates
  SET pending_payout = coalesce(pending_payout, 0) - (v_cents::numeric / 100),
      updated_at = now()
  WHERE id = p_affiliate_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'id', v_claim.id,
    'affiliate_user_id', v_claim.affiliate_user_id,
    'amount_cents', v_claim.amount_cents,
    'destination_account', v_claim.destination_account,
    'idempotency_key', v_claim.idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_affiliate_payout(
  p_claim_id uuid,
  p_stripe_transfer_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.affiliate_payout_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim
  FROM public.affiliate_payout_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_claim.status = 'paid' THEN
    RETURN v_claim.stripe_transfer_id = p_stripe_transfer_id;
  END IF;

  UPDATE public.affiliate_payout_claims
  SET status = 'paid',
      stripe_transfer_id = p_stripe_transfer_id,
      paid_at = now(),
      error_message = NULL
  WHERE id = p_claim_id;

  UPDATE public.affiliates
  SET total_earnings = coalesce(total_earnings, 0) +
        (v_claim.amount_cents::numeric / 100),
      updated_at = now()
  WHERE id = v_claim.affiliate_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_affiliate_payout(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_affiliate_payout(uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.complete_affiliate_payout(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_affiliate_payout(uuid, text)
  TO service_role;

ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payouts_idempotency_key_idx
  ON public.affiliate_payouts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gated_checkout_attempts (
  dedupe_key text PRIMARY KEY,
  checkout_key text NOT NULL UNIQUE,
  plan_id text NOT NULL,
  stripe_session_url text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_rate_limits (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count > 0)
);

CREATE INDEX IF NOT EXISTS checkout_rate_limits_window_idx
  ON public.checkout_rate_limits (window_started_at);

ALTER TABLE public.gated_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gated_checkout_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_rate_limits TO service_role;
REVOKE ALL ON TABLE public.gated_checkout_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.checkout_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_gated_checkout(
  p_checkout_key text,
  p_email_hash text,
  p_ip_hash text,
  p_plan_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window timestamptz;
  v_hits integer;
  v_dedupe_key text;
  v_claimed text;
BEGIN
  IF p_checkout_key IS NULL OR p_checkout_key = '' OR
     p_email_hash IS NULL OR p_ip_hash IS NULL OR p_plan_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  END IF;

  v_window := date_trunc('minute', v_now);
  INSERT INTO public.checkout_rate_limits (ip_hash, window_started_at, hit_count)
  VALUES (p_ip_hash, v_window, 1)
  ON CONFLICT (ip_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN checkout_rate_limits.window_started_at < v_window THEN v_window
        ELSE checkout_rate_limits.window_started_at END,
      hit_count = CASE
        WHEN checkout_rate_limits.window_started_at < v_window THEN 1
        ELSE checkout_rate_limits.hit_count + 1 END
  RETURNING hit_count INTO v_hits;

  IF v_hits > 20 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Too many checkout attempts',
      'retry_after', greatest(1, 60 - extract(second FROM v_now)::integer)
    );
  END IF;

  v_dedupe_key := p_email_hash || ':' || p_plan_id;
  INSERT INTO public.gated_checkout_attempts (dedupe_key, checkout_key, plan_id, expires_at)
  VALUES (v_dedupe_key, p_checkout_key, p_plan_id, v_now + interval '10 minutes')
  ON CONFLICT (dedupe_key) DO UPDATE
  SET checkout_key = EXCLUDED.checkout_key,
      expires_at = EXCLUDED.expires_at,
      created_at = v_now
  WHERE gated_checkout_attempts.expires_at <= v_now
     OR gated_checkout_attempts.checkout_key = p_checkout_key
  RETURNING checkout_key INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'A checkout for this plan was recently started',
      'retry_after', 600
    );
  END IF;

  IF random() < 0.01 THEN
    DELETE FROM public.gated_checkout_attempts WHERE expires_at < v_now - interval '1 day';
    DELETE FROM public.checkout_rate_limits WHERE window_started_at < v_now - interval '1 day';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_gated_checkout_session(
  p_checkout_key text,
  p_session_url text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gated_checkout_attempts
  SET stripe_session_url = p_session_url
  WHERE checkout_key = p_checkout_key;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gated_checkout(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gated_checkout(text, text, text, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_gated_checkout_session(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_gated_checkout_session(text, text)
  TO service_role;
