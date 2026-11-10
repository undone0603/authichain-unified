# x402 Agent Credits — 120 verified lookups for $5 (Stripe prepaid)

**Status: READY FOR AUTOMATED VALIDATION / PRODUCTION HOLD.** No separate human-review signoff is required by the current `main` ruleset (zero required approvals) or the automated protected-deployment policy. Do not merge or deploy without exact-head tests and verified prerequisites.

This is a **new Stripe prepaid rail**, not the live x402 USDC Base 8453 per-call rail and not QRON generation credits. It must never replace `X402_PAY_TO`, `X402_USDC_ASSET`, or `X402_FACILITATOR_URL`.

## Live Stripe catalog evidence (November 8, 2026)

- Account: `acct_1SXIyEGqTruSqV8T`; Product `prod_VapV6HCzVnBxmZ`.
- Live active one-time price: `price_1UZdq5GqTruSqV8TsaDtFBPF`, USD 500 cents.
- Tax-exclusive; Stripe Tax configuration and registrations are separate from the price.
- A catalog product by itself is not a functioning purchase-to-entitlement path.

## Ownership

- Checkout confirm page: `workers/authichain-com/src/index.ts` → `src/lib/checkout-gate.ts`, `/checkout/x402_agent_credits_120`.
- Checkout API and **canonical Stripe webhook**: `worker-app/index.ts` and `server/webhooks/stripe.ts`, deployed as `authichain-edge-router`.
- x402 request processing on the apex: `workers/authichain-com/src/x402-routes.ts`, deployed as `authichain-com`.
- Read-only Next.js webhook mirror refuses the pack to avoid accidental QR-generation grants.
- Prepaid entitlement tables: `x402_agent_pack_grants`, `x402_agent_pack_spends`; the `consume_x402_agent_pack_credit` RPC is service-role only.

## Buy and redeem

1. The buyer opens the confirm page, provides a work email and deliberately submits the form. No GET may create a Checkout Session.
2. The canonical signed webhook accepts only paid, live, USD, one-time Stripe Session with the **actual** matching price ID, exactly one line, quantity one, $5 subtotal and at least $5 total. Metadata and amount alone never constitute proof. The session-ID primary key makes retries idempotent. Atomic grant/reversal SQL functions share a PaymentIntent advisory lock and maintain a reversal tombstone, so a refund or dispute delivered before payment-success cannot be reactivated by a delayed webhook.
3. The new grant records **120 verification credits** under the buyer email; it does not alter `profiles.generations_limit`. A buyer must create/sign into an AuthiChain account using the **same confirmed email**, then issue an active verification-capable API key belonging to that account.
4. Request `POST /api/x402` with `x-authichain-payment-rail: stripe_credits`, `x-api-key: <API_KEY>`, `x-idempotency-key: <unique 16–128 character token>`, and JSON `{"sealId":"<real seal UUID>"}`. This is an explicit alternative, not a silent fallback from USDC.
5. The verifier confirms the API key, its scopes and expiry, and the *confirmed Auth email* through Supabase Auth Admin (never a mutable `profiles.email`). It checks the registry and prepares the bounded evidence result before any credit debit.
6. The service-role RPC serializes the buyer's available credits, checks the idempotency key, atomically records one debit, and refuses exhausted balances. Same key + seal retry is free; key reuse for a different seal is 409. No successful unpaid fallback.
7. On a full/partial charge refund or dispute, the corresponding grant is disabled; ledger history is retained. **Verified 2026-11-08:** canonical live webhook `we_1UGTCSGqTruSqV8ThM9bXVWp` subscribes to `charge.refunded` but **not** `charge.dispute.created`; add the dispute event only through approved Stripe configuration at release. The separate Supabase webhook receives disputes but cannot substitute for this canonical entitlement revocation. Retries of the same reversal are idempotent.

The Stripe prepaid Checkout redirects to a neutral `/x402?checkout=returned` page, not to a DPP activation or payment-success claim. The signed webhook alone controls ledger grants.

## No-charge integration rehearsal (prepared, not executed)

The production PostgreSQL 17.6 project confirms the `api_keys` UUID/text[] schema and the `service_role` RLS-bypass role, as well as the availability of transaction advisory locks. The active project is healthy; the separate default Supabase development-branch metadata reports `MIGRATIONS_FAILED`. Do not confuse that branch's historical status with a failure of this **unapplied** migration.

Run the exact grant/debit/reversal fixture **after migrating an isolated, disposable PostgreSQL database with the existing AuthiChain `api_keys` schema**:

```bash
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/x402_agent_pack_grants.sql
```

The test starts a transaction and ends in `ROLLBACK`. It exercises one paid grant, duplicate grant, exact 120-credit consumption, replay without double-debit, key reuse for another seal, the rejected 121st lookup, refund/replay revocation, refund-before-success, and dispute-before-success. Its fake `api_keys` row is solely a disposable SQL fixture; the separate API tests check confirmed Auth owner binding. This tests sequential state transitions, **not true parallel transaction concurrency**; concurrent clients must still be tested with genuine parallel sessions before activation.

CircleCI's `test-workers` now also runs `node --test scripts/ci/x402-ledger-contract.test.mjs` and the four prepaid Vitest suites. Those static SQL invariants have passed read-only source checks, but **the candidate's actual native CI and PostgreSQL integration fixture have not yet been executed**.

## Required release sequence

1. Isolated executor: run native tests (Vitest for `x402-agent-pack*.test.ts`, checkout gate, webhook, x402 routes, Worker TypeScript); validate the exact candidate SHA, not an old green check.
2. Perform reproducible automated security and integration checks for the prepaid verifier and DB transaction: confirm Auth Admin binding, RLS/GRANTs, idempotency, fulfillment retries, refund and dispute handling, and Worker secret isolation. Capture results on the exact candidate SHA. A separate human signoff is optional unless the actual GitHub rules change.
3. Apply `supabase/migrations/20261108215700_x402_agent_pack_credits.sql` on the authorized production project `nhdnkzhtadfkkluiulhs` only through its protected migration workflow. Test table policies, RPC grants and atomic concurrent spends. Ensure no grant is created on unpaid or $0 test sessions.
4. Release the approved code through the protected Cloudflare deployment workflow. Do not run `npx wrangler secret put` directly: it immediately deploys a new Worker version.
5. The **public price and credit count are already staged** as default-off `[vars]` in both `authichain-com` (checkout + verifier) and `authichain-edge-router` (Checkout API + webhook). Verify the exact deployed version retains them, and after approval deliberately enable checkout through a separate protected configuration release:
   - `X402_PACK_PRICE_ID=price_1UZdq5GqTruSqV8TsaDtFBPF`
   - `X402_PACK_CREDITS=120`
   - `X402_PACK_ENABLED=true` **only after** migration, code, automated security and worker smoke tests pass (currently `false` in both `wrangler.toml` files).
   These two values are **non-secret**; don't write them as Worker secrets. Change the staged flag through the approved PR/Worker promotion workflow and retain other bindings. Do not run direct `wrangler secret put`.
6. Read-only checks: GET confirm page (200 after enable); GET /api/x402/health (200); an unpaid x402 POST still yields its normal USDC 402 quote; a malformed prepaid body must return 400 without spending.
7. Prove the paid flow with a consented external buyer in live mode (never charge the founder/test card for evidence): check paid session, one grant, receipt, API key verified against confirmed buyer email, one decrement from 120 to 119, replay no double decrement, and 120th then exhausted call. Prove refund disables unspent credits. The first real buyer is not verified until this evidence exists.
8. Capture actual deployed code SHA, Cloudflare version/deployment IDs, Stripe event/session IDs, database row IDs, native CI run links and the enforced automated release-policy result. Missing evidence is BLOCKED, not GO.

## Rollback / kill

- Remove or set `X402_PACK_ENABLED=false` in a **controlled Worker version** to block new pack Checkout and prepaid verification. Existing x402 USDC remains unaffected.
- Preserve grants/spends and Stripe records for reconciliation; do not delete purchase evidence or refund rights.
- Do not enable public copy or offer promotion until customer fulfillment is independently proven.

**Current evidence:** Live Stripe price exists. New code and SQL are staged only on a GitHub branch, not merged, not migrated, not active or deployed. No new charge, checkout session, customer credit or verification debit has been attempted.

### Hardening on November 10

Both Checkout surfaces must send a **neutral** x402 return; even a valid Stripe redirect is not payment/grant proof. Pack-created PaymentIntents carry the server-assigned `plan` and `stripe_price_id` metadata. On refunds/disputes, the canonical Stripe webhook retrieves the PaymentIntent from Stripe before touching the x402 ledger. An unrelated refund must not be held hostage by an unavailable pack ledger or recorded as an x402 reversal; Stripe lookup outages fail with a retryable error. Independent tests cover this distinction.

## Avoid unnecessary gates (November 10, 2026)

The active `main-no-direct-push` ruleset currently sets `required_approving_review_count: 0` with no bypass actors. The approved `deploy-authichain-com.yml` executes `autonomous-release-gate.mjs`, which expressly replaces a manual environment reviewer with exact-main CircleCI evidence and protected environment validation. **Do not add a new manual security-review or deployment-approval requirement to this pack.** The seven-context main gate remains mandatory for the protected Worker deployment; payment and credit-ledger correctness tests remain mandatory before enabling a real-money checkout. Do not equate green CI on an older `main` SHA with candidate-head validation.

The physical production environment and its Worker-scoped deployment credentials still have to exist; an automated signoff cannot supply missing credentials or a missing database migration. These are implementation prerequisites, not discretionary bureaucracy. The Stripe canonical webhook must subscribe to charge-dispute events before selling a pack if dispute revocation is part of the promise. Keep `X402_PACK_ENABLED=false` until it can be proven that a paid non-founder purchase is settled and redeemed exactly once without disrupting the live Base USDC path.
