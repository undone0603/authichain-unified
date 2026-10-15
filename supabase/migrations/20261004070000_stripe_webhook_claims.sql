CREATE TABLE IF NOT EXISTS public.stripe_webhook_claims (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed')),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.stripe_webhook_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe webhook claims"
  ON public.stripe_webhook_claims
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_claims
  TO service_role;

CREATE TABLE IF NOT EXISTS public.x402_spend_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer text NOT NULL,
  amount_atomic bigint NOT NULL CHECK (amount_atomic > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_x402_spend_reservations_payer_created
  ON public.x402_spend_reservations (lower(payer), created_at);

ALTER TABLE public.x402_spend_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages x402 spend reservations"
  ON public.x402_spend_reservations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

GRANT SELECT, INSERT, DELETE ON public.x402_spend_reservations
  TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_x402_spend(
  p_payer text,
  p_amount_atomic bigint,
  p_cap_atomic bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spent_atomic bigint;
  legacy_spent_atomic bigint;
  reservation_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_payer IS NULL OR btrim(p_payer) = ''
     OR p_amount_atomic <= 0 OR p_cap_atomic <= 0 THEN
    RAISE EXCEPTION 'invalid spend reservation';
  END IF;

  DELETE FROM public.x402_spend_reservations
   WHERE created_at <= now() - interval '24 hours';

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_payer), 0));

  SELECT COALESCE(SUM(amount_atomic), 0)
    INTO spent_atomic
    FROM public.x402_spend_reservations
   WHERE lower(payer) = lower(p_payer)
     AND created_at > now() - interval '24 hours';

  SELECT count(*)::bigint * p_amount_atomic
    INTO legacy_spent_atomic
    FROM public.automation_logs
   WHERE workflow_name = 'x402_spend'
     AND lower(payload::text) = lower(p_payer)
     AND created_at > now() - interval '24 hours';

  IF spent_atomic + legacy_spent_atomic + p_amount_atomic > p_cap_atomic THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.x402_spend_reservations (payer, amount_atomic)
  VALUES (lower(p_payer), p_amount_atomic)
  RETURNING id INTO reservation_id;

  RETURN reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_x402_spend(text, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_x402_spend(text, bigint, bigint)
  TO service_role;
