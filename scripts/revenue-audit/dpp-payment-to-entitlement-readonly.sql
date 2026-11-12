-- Read-only DPP evidence audit, executed successfully on the connected
-- QRON-v2 Supabase project on 2026-11-12. Do not include PII in output.
-- Important: funnel payment_succeeded != Stripe settlement; a profile grant
-- != activation email or authenticated customer access. Never count this
-- query as verified cash revenue.
--
-- Independent Stripe reconciliation for every session ID is still required:
-- live mode; non-demo/non-founder buyer; correct one-time DPP price ID;
-- completed and paid session; successful positive-value PaymentIntent with
-- amount actually received; no refund/chargeback; correct email identity.
-- Do not manufacture a purchase or test on a live card.
WITH funnel AS (
  SELECT
    metadata->>'stripe_session_id' AS session_id,
    bool_or(event_type = 'dpp_loop:payment_succeeded') AS funnel_payment,
    bool_or(event_type = 'dpp_loop:provisioned') AS funnel_provisioned,
    bool_or(event_type = 'dpp_activation_email:failed') AS activation_failure
  FROM public.funnel_events
  WHERE metadata->>'stripe_session_id' IS NOT NULL
    AND event_type IN (
      'dpp_loop:payment_succeeded',
      'dpp_loop:provisioned',
      'dpp_activation_email:failed'
    )
  GROUP BY metadata->>'stripe_session_id'
), receipts AS (
  SELECT
    session_id,
    bool_or(
      event_type = 'checkout.session.completed' AND status = 'success'
    ) AS webhook_success
  FROM public.stripe_events
  WHERE session_id IS NOT NULL
  GROUP BY session_id
)
SELECT
  f.session_id,
  f.funnel_payment,
  f.funnel_provisioned,
  f.activation_failure,
  -- NULL means no session-linked receipt was available for this session;
  -- the alternate Next.js webhook stores events without session_id.
  -- Do not report a missing link as a proven failed webhook.
  CASE WHEN r.session_id IS NULL THEN NULL
       ELSE coalesce(r.webhook_success, false)
  END AS webhook_success,
  CASE WHEN r.session_id IS NULL THEN 'session_link_unavailable'
       WHEN r.webhook_success THEN 'linked_success'
       ELSE 'linked_no_success'
  END AS webhook_linkage,
  (
    p.last_grant_session_id IS NOT NULL
    AND p.generations_limit >= 50
  ) AS durable_50_grant,
  CASE
    WHEN p.last_grant_session_id IS NULL THEN 'unverified_grant'
    ELSE 'grant_record_present_only'
  END AS proof_stage
FROM funnel f
LEFT JOIN receipts r USING (session_id)
LEFT JOIN public.profiles p
  ON p.last_grant_session_id = f.session_id
ORDER BY f.session_id;
