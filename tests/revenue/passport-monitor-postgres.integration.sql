-- Run ONLY in a fresh disposable PostgreSQL database AFTER the dormant migration.
-- Example: psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -f supabase/migrations/20261112000001_passport_monitor_dormant_entitlements.sql \
--   -f tests/revenue/passport-monitor-postgres.integration.sql
-- Rolls back all synthetic invoice and entitlement rows; never use production.
BEGIN;
DO $$
DECLARE v jsonb; v_state record; v_n integer;
BEGIN
  IF pg_catalog.has_function_privilege('anon','public.passport_monitor_apply_verified_event(jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.passport_monitor_apply_verified_event(jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.passport_monitor_consume_verification(text,text,bigint)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.passport_monitor_consume_verification(text,text,bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'unsafe RPC grants';
  END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_001","type":"invoice.paid","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH","invoiceId":"in_test_001","amountPaid":7900,"currency":"usd","periodStart":1000,"periodEnd":2000}'::jsonb);
  IF v->>'action' <> 'activated' THEN RAISE EXCEPTION 'activation failed: %',v; END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_001","type":"invoice.paid","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH","invoiceId":"in_test_001","amountPaid":7900,"currency":"usd","periodStart":1000,"periodEnd":2000}'::jsonb);
  IF v->>'action' <> 'duplicate' THEN RAISE EXCEPTION 'event idempotency failed'; END IF;
  FOR v_n IN 1..300 LOOP
    v := public.passport_monitor_consume_verification('sub_test_001','cus_test_001',1500);
    IF v->>'ok' <> 'true' THEN RAISE EXCEPTION 'expected verification % to pass',v_n; END IF;
  END LOOP;
  IF public.passport_monitor_consume_verification('sub_test_001','cus_test_001',1500)->>'ok' <> 'false' THEN
    RAISE EXCEPTION 'quota exceeded';
  END IF;
  IF public.passport_monitor_consume_verification('sub_test_001','cus_other_001',1500)->>'ok' <> 'false' THEN
    RAISE EXCEPTION 'cross-customer consume succeeded';
  END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_002","type":"invoice.paid","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH","invoiceId":"in_test_002","amountPaid":7900,"currency":"usd","periodStart":2000,"periodEnd":3000}'::jsonb);
  IF v->>'action' <> 'renewed' THEN RAISE EXCEPTION 'renewal failed: %',v; END IF;
  SELECT used,status INTO v_state FROM public.passport_monitor_entitlements WHERE subscription_id='sub_test_001';
  IF v_state.used <> 0 OR v_state.status <> 'active' THEN RAISE EXCEPTION 'renewal reset failed'; END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_003","type":"invoice.payment_failed","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH","periodStart":1000,"periodEnd":2000}'::jsonb);
  IF v->>'reason' <> 'stale_or_unknown_failed_period' THEN RAISE EXCEPTION 'late failure suspended newer period'; END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_004","type":"customer.subscription.deleted","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH"}'::jsonb);
  IF v->>'action' <> 'cancelled' THEN RAISE EXCEPTION 'cancellation failed'; END IF;
  IF public.passport_monitor_consume_verification('sub_test_001','cus_test_001',2200)->>'ok' <> 'false' THEN
    RAISE EXCEPTION 'cancelled entitlement still usable';
  END IF;
  v := public.passport_monitor_apply_verified_event('{"id":"evt_test_005","type":"invoice.paid","subscriptionId":"sub_test_001","customerId":"cus_test_001","priceId":"price_1USJytGqTruSqV8TpbDuW6bH","invoiceId":"in_test_005","amountPaid":7900,"currency":"usd","periodStart":3000,"periodEnd":4000}'::jsonb);
  IF v->>'reason' <> 'cancelled_terminal' THEN RAISE EXCEPTION 'cancelled account reactivated'; END IF;
END;
$$;
ROLLBACK;
