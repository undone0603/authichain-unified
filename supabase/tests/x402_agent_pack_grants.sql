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
  v_api_key_id uuid := pg_catalog.gen_random_uuid();
  v_seal_id uuid := pg_catalog.gen_random_uuid();
  v_idem text := 'idem_fixture_' || v_run;
  v_decision jsonb;
  v_i integer;
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

  -- The debit RPC requires a live API key with 'verify' scope. This is a
  -- synthetic, disposable DB fixture: the API's real verified-owner check is
  -- exercised separately by the application tests. The entire transaction
  -- rolls back including this key.
  INSERT INTO public.api_keys(id, name, key_hash, scopes, is_active)
    VALUES (v_api_key_id, 'x402_sql_fixture', v_run || v_run, ARRAY['verify']::text[], true);
  v_decision := public.consume_x402_agent_pack_credit(v_api_key_id, v_idem, v_seal_id, v_buyer);
  IF v_decision->>'allowed' <> 'true' OR v_decision->>'replayed' <> 'false' OR
      (v_decision->>'remaining_credits')::integer <> 119 THEN
    RAISE EXCEPTION 'first spend failed: %', v_decision;
  END IF;
  v_decision := public.consume_x402_agent_pack_credit(v_api_key_id, v_idem, v_seal_id, v_buyer);
  IF v_decision->>'allowed' <> 'true' OR v_decision->>'replayed' <> 'true' OR
      (v_decision->>'remaining_credits')::integer <> 119 THEN
    RAISE EXCEPTION 'idempotent replay changed balance: %', v_decision;
  END IF;
  v_decision := public.consume_x402_agent_pack_credit(
    v_api_key_id, v_idem, pg_catalog.gen_random_uuid(), v_buyer);
  IF v_decision->>'reason' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'idempotency key reused for a new seal: %', v_decision;
  END IF;

  -- Exhaust the remaining 119 prepaid lookups, then reject the 121st.
  FOR v_i IN 1..119 LOOP
    v_decision := public.consume_x402_agent_pack_credit(
      v_api_key_id, 'idem_cycle_' || v_run || '_' || v_i::text,
      v_seal_id, v_buyer);
    IF v_decision->>'allowed' <> 'true' THEN
      RAISE EXCEPTION 'credit % of 120 not redeemed: %', v_i + 1, v_decision;
    END IF;
  END LOOP;
  IF (v_decision->>'remaining_credits')::integer <> 0 THEN
    RAISE EXCEPTION '120th purchase did not exhaust balance: %', v_decision;
  END IF;
  v_decision := public.consume_x402_agent_pack_credit(
    v_api_key_id, v_idem || '_exhausted', v_seal_id, v_buyer);
  IF v_decision->>'reason' <> 'credits_exhausted' THEN
    RAISE EXCEPTION '121st lookup was not blocked: %', v_decision;
  END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_spends
    WHERE api_key_id = v_api_key_id;
  IF v_count <> 120 THEN RAISE EXCEPTION 'replay or exhausted call double-debited'; END IF;

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
  -- A later dispute must upgrade the ledger, and a later refund cannot
  -- downgrade either the tombstone or the existing grant from disputed.
  IF NOT public.reverse_x402_agent_pack(v_paid_intent, 'disputed') THEN
    RAISE EXCEPTION 'dispute failed to supersede refund'; END IF;
  IF NOT public.reverse_x402_agent_pack(v_paid_intent, 'refunded') THEN
    RAISE EXCEPTION 'late refund failed'; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_grants
    WHERE payment_intent_id = v_paid_intent AND status = 'disputed';
  IF v_count <> 1 THEN RAISE EXCEPTION 'late refund downgraded disputed grant'; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_reversals
    WHERE payment_intent_id = v_paid_intent AND status = 'disputed';
  IF v_count <> 1 THEN RAISE EXCEPTION 'late refund downgraded dispute tombstone'; END IF;
  v_decision := public.consume_x402_agent_pack_credit(v_api_key_id, v_idem, v_seal_id, v_buyer);
  IF v_decision->>'reason' <> 'grant_revoked' THEN
    RAISE EXCEPTION 'revoked purchase still authorizes replay: %', v_decision;
  END IF;

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
  IF NOT public.reverse_x402_agent_pack(v_dispute_first_intent, 'refunded') THEN
    RAISE EXCEPTION 'late refund after dispute failed'; END IF;
  SELECT count(*) INTO v_count FROM public.x402_agent_pack_reversals
    WHERE payment_intent_id = v_dispute_first_intent AND status = 'disputed';
  IF v_count <> 1 THEN RAISE EXCEPTION 'dispute-first tombstone was downgraded'; END IF;
  v_result := public.grant_x402_agent_pack(v_dispute_first_session, v_dispute_first_intent, v_buyer);
  IF v_result <> 'reversed' THEN RAISE EXCEPTION 'disputed purchase was re-granted'; END IF;

  RAISE NOTICE 'x402 grant/reversal fixture passed; all fake rows roll back';
END
$contract$;

ROLLBACK;
