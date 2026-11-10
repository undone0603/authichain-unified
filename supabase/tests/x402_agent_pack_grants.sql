-- x402 prepaid agent-credit grant/reversal acceptance fixture.
-- Run only AFTER the corresponding migration on a disposable PostgreSQL 17 DB.
-- This explicitly ROLLS BACK all fake session/grant/reversal rows.
-- No Stripe calls, charges, or production billing occur.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '15s';

DO $contract$
DECLARE
  v_run text := replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_buyer text := 'fixture-' || v_run || '@example.invalid';
  v_paid_session text := 'cs_live_fixture_paid_' || v_run;
  v_paid_intent text := 'pi_fixture_paid_' || v_run;
  v_refund_first_session text := 'cs_live_fixture_refundfirst_' || v_run;
  v_refund_first_intent text := 'pi_fixture_refundfirst_' || v_run;
  v_dispute_first_session text := 'cs_live_fixture_disputefirst_' || v_run;
  v_dispute_first_intent text := 'pi_fixture_disputefirst_' || v_run;
  v_result text;
  v_count integer;
BEGIN
  -- A successful paid session grants exactly one pack, and a retry adds zero.
  v_result := public.grant_x402_agent_pack(v_paid_session, v_paid_intent, v_buyer);
  IF v_result <> 'granted' THEN RAISE EXCEPTION 'new paid grant: %', v_result; END IF;
  v_result := public.grant_x402_agent_pack(v_paid_session, v_paid_intent, v_buyer);
  IF v_result <> 'existing' THEN RAISE EXCEPTION 'duplicate paid grant: %', v_result; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_grants
    WHERE payment_intent_id = v_paid_intent AND credits_total = 120
      AND credits_used = 0 AND status = 'active';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate mint or incorrect 120-credit grant'; END IF;

  -- A refund revokes the purchased credits even after an event replay.
  IF NOT public.reverse_x402_agent_pack(v_paid_intent, 'refunded') THEN
    RAISE EXCEPTION 'refund failed'; END IF;
  IF NOT public.reverse_x402_agent_pack(v_paid_intent, 'refunded') THEN
    RAISE EXCEPTION 'duplicate refund failed'; END IF;
  v_result := public.grant_x402_agent_pack(v_paid_session, v_paid_intent, v_buyer);
  IF v_result <> 'reversed' THEN RAISE EXCEPTION 'grant resurrected after refund'; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_grants
    WHERE payment_intent_id = v_paid_intent AND status = 'refunded';
  IF v_count <> 1 THEN RAISE EXCEPTION 'refund status missing'; END IF;

  -- Out-of-order Stripe events cannot mint previously reversed purchases.
  IF NOT public.reverse_x402_agent_pack(v_refund_first_intent, 'refunded') THEN
    RAISE EXCEPTION 'early refund tombstone failed'; END IF;
  v_result := public.grant_x402_agent_pack(v_refund_first_session, v_refund_first_intent, v_buyer);
  IF v_result <> 'reversed' THEN RAISE EXCEPTION 'late paid webhook re-granted refunded purchase'; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_grants
    WHERE payment_intent_id = v_refund_first_intent;
  IF v_count <> 0 THEN RAISE EXCEPTION 'refund-first ghost grant'; END IF;

  -- Dispute-first protection is independent of the ordinary refund event.
  IF NOT public.reverse_x402_agent_pack(v_dispute_first_intent, 'disputed') THEN
    RAISE EXCEPTION 'early dispute tombstone failed'; END IF;
  v_result := public.grant_x402_agent_pack(v_dispute_first_session, v_dispute_first_intent, v_buyer);
  IF v_result <> 'reversed' THEN RAISE EXCEPTION 'disputed purchase was re-granted'; END IF;

  RAISE NOTICE 'x402 grant/reversal fixture passed; all fake rows roll back';
END
$contract$;

ROLLBACK;
