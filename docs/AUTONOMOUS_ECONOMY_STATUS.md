# Autonomous economy status

Evidence read on 2026-10-13 from Supabase project `nhdnkzhtadfkkluiulhs` and the live webhook route. This is not a claim that the autonomous economy is complete.

## VERIFIED

- `POST https://authichain.com/api/stripe/webhook` with a dummy `stripe-signature` returns HTTP 400 and reports `STRIPE_WEBHOOK_SECRET=set` and `STRIPE_WEBHOOK_AUTHICHAIN_SECRET=set`. That shows the secrets are bound. It does not show a signature-verified payment delivery.
- `public.stripe_events` contains 129 `checkout.session.expired` rows with `status=success` and `http_status=200`, latest `2026-10-11`. Those deliveries passed signature verification.
- A later read on 2026-10-13 after 18:25Z supersedes the earlier zero-grant sentence. `public.profiles` has 4 rows, 1 `last_grant_session_id`, 1 `generations_limit = 50`, 1 `last_payment_at`, and 0 `stripe_customer_id`. That grant is an `authichain.com` demo profile, session prefix `cs_live_a1YwNmpf7ODzyhHayglo`, amount 0, `is_demo` true, with no `merchant_activated` row. It is not a $299 buyer.
- The only non-demo `dpp_loop:payment_succeeded` row with a positive amount is 1000 cents, plan `dpp_readiness`, and the payer is a founder address. `classifyRevenue` does not count a founder charge as revenue. That profile is still `tier=free` with `generations_limit=0`. It was not backfilled.
- Other `payment_succeeded` / `provisioned` / `merchant_activated` / `retained` funnel rows are `is_demo`, amount 0, or the DPP-SMOKE-E2E promo.
- `public.entitlements` is empty. `checkout_sessions` is empty.
- Agent outbound tables from `schema/agent-outbound.sql` are not present on D1 `authichain-db`. The verify worker does not bind that database, so the file was not applied.
- License D1 `authichain-license-db` already has `licenses`, `stripe_events`, and `idx_licenses_one_active_customer`. GS1 `seals.fingerprint_sha256` and `idx_seals_cert_nocase` are present on `authichain-db`.

## IMPLEMENTED BUT NOT LIVE-VERIFIED

- The grant fix is on `main` as `d144c215` and was deployed. `provisionPurchase` no longer writes `subscribed_at`. A failed entitlement update throws before `dpp_loop:provisioned`. The $0 demo above is the live persistence check. A non-founder $299 checkout has not been fulfilled.
- Verifiable outbound for Scout and AgentZ is PR 1829 at `f0ea114d`, even with `main`, checks green, labeled `hold`, and not merged. `production_send` stays false. No mail has been sent. PR 1832 is also labeled `hold` and must not merge: it would clear `humanHold` for the $299 price.

## BLOCKED

- GitHub Actions workflow "D1 license migrate" fails with Cloudflare error 7403. The Actions API token can publish Workers and cannot query D1. Do not rerun that workflow until the token has D1 edit on the account that owns the databases. Schema for the license database is already applied.
- Stripe CLI in this session has no API key, and the Stripe MCP connector is not authenticated. A fresh provider charge list was not read. The Supabase webhook and profile tables are the evidence above.
- Real outbound remains blocked: no authorized recipient, `production_send` is false, and send stays behind the existing recipient and campaign gates.
- No stranger livemode payment for the $299 EU DPP Workspace is in `stripe_events` or `profiles`. There is no active buyer.

## NOT COMPLETE

- Payment, exactly-one entitlement, activation, and first value for a non-founder customer.
- An authenticated agent discovering a real prospect and delivering through an authorized transport.
- Retention of a paying customer. The retained funnel row is the DPP-SMOKE-E2E demo.
- Hardhat was not run for this change. No Solidity files were edited.

## Founder-exit continuity

`src/lib/founder-exit/ledger.ts` records operational actions, leases, and recovery. It is not a second economic ledger. The isolated drill in `docs/evidence/founder-exit-drill.json` passes. That pass does not make the business founder-independent: the ledger is not bound to production Supabase, backups were not restored, outbound send stays off, and there is still no non-founder $299 grant. See `docs/FOUNDER_INDEPENDENCE.md`.
