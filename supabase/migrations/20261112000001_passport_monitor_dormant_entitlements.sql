-- DORMANT: Passport Monitor $79/mo. Not called by live routes or deployed by this PR.
-- Atomic service-role-only event claims, subscription state and consumption.
-- A trusted server MUST validate the Stripe signature before calling apply.
-- Do NOT grant these functions to anon/authenticated or expose a public endpoint.
CREATE TABLE IF NOT EXISTS public.passport_monitor_entitlements (
  subscription_id text PRIMARY KEY,
  customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','past_due','cancelled')),
  period_start bigint,
  period_end bigint,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= 300),
  last_invoice_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((period_start IS NULL AND period_end IS NULL) OR (period_start >= 0 AND period_end > period_start))
);
CREATE TABLE IF NOT EXISTS public.passport_monitor_processed_events (
  event_id text PRIMARY KEY,
  subscription_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_monitor_events_subscription ON public.passport_monitor_processed_events(subscription_id);
ALTER TABLE public.passport_monitor_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_monitor_processed_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.passport_monitor_entitlements, public.passport_monitor_processed_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.passport_monitor_entitlements TO service_role;
GRANT SELECT, INSERT ON TABLE public.passport_monitor_processed_events TO service_role;

CREATE OR REPLACE FUNCTION public.passport_monitor_apply_verified_event(p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event_id text := p_event->>'id';
  v_type text := p_event->>'type';
  v_sub text := p_event->>'subscriptionId';
  v_customer text := p_event->>'customerId';
  v_price text := p_event->>'priceId';
  v_invoice text := p_event->>'invoiceId';
  v_amount bigint;
  v_start bigint;
  v_end bigint;
  v_row public.passport_monitor_entitlements%ROWTYPE;
  v_status text;
BEGIN
  -- Values must come from the server's verified Stripe event parser, not user input.
  IF p_event IS NULL OR COALESCE(v_event_id,'') !~ '^evt_[A-Za-z0-9_]+$'
     OR COALESCE(v_sub,'') !~ '^sub_[A-Za-z0-9_]+$'
     OR COALESCE(v_customer,'') !~ '^cus_[A-Za-z0-9_]+$'
     OR COALESCE(v_price,'') <> 'price_1USJytGqTruSqV8TpbDuW6bH'
     OR COALESCE(v_type,'') NOT IN ('invoice.paid','invoice.payment_failed','customer.subscription.deleted')
  THEN RETURN jsonb_build_object('ok',false,'reason','invalid_identity_or_price'); END IF;
  -- Cross-subscription race prevention, including the first row insertion.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('passport_monitor:' || v_sub,0));
  IF EXISTS (SELECT 1 FROM public.passport_monitor_processed_events WHERE event_id=v_event_id) THEN
    RETURN jsonb_build_object('ok',true,'action','duplicate');
  END IF;
  SELECT * INTO v_row FROM public.passport_monitor_entitlements WHERE subscription_id=v_sub FOR UPDATE;
  IF FOUND AND v_row.customer_id <> v_customer THEN
    RETURN jsonb_build_object('ok',false,'reason','customer_mismatch');
  END IF;
  IF v_type = 'invoice.paid' THEN
    IF COALESCE(p_event->>'amountPaid','') !~ '^[0-9]+$'
       OR COALESCE(p_event->>'periodStart','') !~ '^[0-9]+$'
       OR COALESCE(p_event->>'periodEnd','') !~ '^[0-9]+$'
       OR COALESCE(v_invoice,'') !~ '^in_[A-Za-z0-9_]+$'
       OR COALESCE(p_event->>'currency','') <> 'usd'
    THEN RETURN jsonb_build_object('ok',false,'reason','unsettled_or_invalid_invoice'); END IF;
    v_amount := (p_event->>'amountPaid')::bigint;
    v_start := (p_event->>'periodStart')::bigint;
    v_end := (p_event->>'periodEnd')::bigint;
    IF v_amount <= 0 OR v_end <= v_start THEN
      RETURN jsonb_build_object('ok',false,'reason','unsettled_or_invalid_invoice');
    END IF;
    IF v_row.status = 'cancelled' THEN
      RETURN jsonb_build_object('ok',false,'reason','cancelled_terminal');
    END IF;
    IF v_row.subscription_id IS NOT NULL AND v_start < v_row.period_start THEN
      RETURN jsonb_build_object('ok',false,'reason','stale_invoice');
    END IF;
    IF v_row.subscription_id IS NULL THEN
      INSERT INTO public.passport_monitor_entitlements
        (subscription_id,customer_id,status,period_start,period_end,used,last_invoice_id)
      VALUES (v_sub,v_customer,'active',v_start,v_end,0,v_invoice);
      v_status := 'activated';
    ELSIF v_row.period_start = v_start THEN
      IF v_row.period_end <> v_end THEN
        RETURN jsonb_build_object('ok',false,'reason','conflicting_period');
      END IF;
      IF v_row.status = 'past_due' THEN
        UPDATE public.passport_monitor_entitlements SET status='active',last_invoice_id=v_invoice,updated_at=now()
        WHERE subscription_id=v_sub;
        v_status := 'restored';
      ELSE v_status := 'unchanged'; END IF;
    ELSE
      UPDATE public.passport_monitor_entitlements
        SET status='active',period_start=v_start,period_end=v_end,used=0,last_invoice_id=v_invoice,updated_at=now()
      WHERE subscription_id=v_sub;
      v_status := 'renewed';
    END IF;
  ELSE
    IF v_row.subscription_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','subscription_not_active'); END IF;
    IF v_type = 'invoice.payment_failed' THEN
      IF (p_event->>'periodStart') !~ '^[0-9]+$' OR (p_event->>'periodEnd') !~ '^[0-9]+$'
      THEN RETURN jsonb_build_object('ok',false,'reason','invalid_failed_period'); END IF;
      v_start := (p_event->>'periodStart')::bigint;
      v_end := (p_event->>'periodEnd')::bigint;
      IF v_start <> v_row.period_start OR v_end <> v_row.period_end THEN
        RETURN jsonb_build_object('ok',false,'reason','stale_or_unknown_failed_period');
      END IF;
      IF v_row.status = 'cancelled' THEN v_status := 'unchanged';
      ELSE
        UPDATE public.passport_monitor_entitlements SET status='past_due',updated_at=now() WHERE subscription_id=v_sub;
        v_status := 'suspended';
      END IF;
    ELSE
      UPDATE public.passport_monitor_entitlements SET status='cancelled',updated_at=now() WHERE subscription_id=v_sub;
      v_status := 'cancelled';
    END IF;
  END IF;
  INSERT INTO public.passport_monitor_processed_events(event_id,subscription_id) VALUES (v_event_id,v_sub);
  RETURN jsonb_build_object('ok',true,'action',v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.passport_monitor_consume_verification(p_subscription_id text,p_customer_id text,p_now bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_used integer;
BEGIN
  IF COALESCE(p_subscription_id,'') !~ '^sub_[A-Za-z0-9_]+$' OR COALESCE(p_customer_id,'') !~ '^cus_[A-Za-z0-9_]+$'
     OR p_now IS NULL OR p_now < 0 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_identity');
  END IF;
  UPDATE public.passport_monitor_entitlements SET used=used+1,updated_at=now()
  WHERE subscription_id=p_subscription_id AND customer_id=p_customer_id
    AND status='active' AND p_now >= period_start AND p_now < period_end AND used < 300
  RETURNING used INTO v_used;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','quota_or_status_denied'); END IF;
  RETURN jsonb_build_object('ok',true,'used',v_used,'remaining',300-v_used);
END;
$$;
REVOKE ALL ON FUNCTION public.passport_monitor_apply_verified_event(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.passport_monitor_consume_verification(text,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_monitor_apply_verified_event(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.passport_monitor_consume_verification(text,text,bigint) TO service_role;
-- Migration must be independently reviewed before applying to ANY database.
