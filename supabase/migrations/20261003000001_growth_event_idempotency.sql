-- Make Stripe-originated Starter outcomes safe to replay without suppressing
-- anonymous and other non-idempotent funnel observations.

ALTER TABLE public.growth_loop_events
  ADD COLUMN IF NOT EXISTS idempotency_key text
    CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS growth_loop_events_event_idempotency_idx
  ON public.growth_loop_events (event, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.growth_record_event_idempotent(
  p_event text,
  p_loop text,
  p_sku text,
  p_founder boolean,
  p_email_hash text,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event NOT IN ('checkout_abandoned', 'purchase_starter_succeeded')
     OR p_loop <> 'loop_03_qron_starter'
     OR p_sku <> 'starter' THEN
    RAISE EXCEPTION 'invalid_idempotent_growth_event' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'idempotency_key_must_be_sha256_hex' USING ERRCODE = '22023';
  END IF;

  IF p_email_hash IS NOT NULL AND p_email_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'email_hash_must_be_sha256_hex' USING ERRCODE = '22023';
  END IF;

  IF p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'occurred_at_in_future' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.growth_loop_events
    (event, loop, sku, founder, email_hash, occurred_at, idempotency_key)
  VALUES
    (p_event, p_loop, p_sku, coalesce(p_founder, false), p_email_hash,
     coalesce(p_occurred_at, now()), p_idempotency_key)
  ON CONFLICT (event, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.growth_record_event_idempotent(
  text, text, text, boolean, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_record_event_idempotent(
  text, text, text, boolean, text, timestamptz, text
) TO service_role;
