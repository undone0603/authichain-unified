# x402 Agent Credits — 120 verified lookups for $5 (Stripe prepaid)

**Status: DRAFT / HOLD — DO NOT MERGE OR DEPLOY without exact-head tests and independent review.**

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
2. The canonical signed webhook accepts only paid, live, USD, one-time Stripe Session with the **actual** matching price ID, exactly one line, quantity one, $5 subtotal and at least $5 total. Metadata and amount alone never constitute proof. The session-ID primary key makes retries idempotent.
3. The new grant records **120 verification credits** under the buyer email; it does not alter `profiles.generations_limit`. A buyer must create/sign into an AuthiChain account using the **same confirmed email**, then issue an active verification-capable API key belonging to that account.
4. Request `POST /api/x402` with `x-authichain-payment-rail: stripe_credits`, `x-api-key: <API_KEY>`, `x-idempotency-key: <unique 16–128 character token>`, and JSON `{"sealId":"<real seal UUID>"}`. This is an explicit alternative, not a silent fallback from USDC.
5. The verifier confirms the API key, its scopes and expiry, and the *confirmed Auth email* through Supabase Auth Admin (never a mutable `profiles.email`). It checks the registry and prepares the bounded evidence result before any credit debit.
6. The service-role RPC serializes the buyer's available credits, checks the idempotency key, atomically records one debit, and refuses exhausted balances. Same key + seal retry is free; key reuse for a different seal is 409. No successful unpaid fallback.
7. On a full/partial charge refund or dispute, the corresponding grant is disabled; ledger history is retained. **Verified 2026-11-08:** canonical live webhook `we_1UGTCSGqTruSqV8ThM9bXVWp` subscribes to `charge.refunded` but **not** `charge.dispute.created`; add the dispute event only through approved Stripe configuration at release. The separate Supabase webhook receives disputes but cannot substitute for this canonical entitlement revocation. Retries of the same reversal are idempotent.

## Required release sequence

1. Isolated executor: run native tests (Vitest for `x402-agent-pack*.test.ts`, checkout gate, webhook, x402 routes, Worker TypeScript); validate the exact candidate SHA, not an old green check.
2. Get independent security review for the prepaid verifier and DB transaction: confirm Auth Admin binding, RLS/GRANTs, idempotency, fulfillment retries, refund and dispute handling. Inspect Cloudflare Worker secret isolation.
3. Apply `supabase/migrations/20261108215700_x402_agent_pack_credits.sql` on the authorized production project `nhdnkzhtadfkkluiulhs` only through its protected migration workflow. Test table policies, RPC grants and atomic concurrent spends. Ensure no grant is created on unpaid or $0 test sessions.
4. Release the approved code through the protected Cloudflare deployment workflow. Do not run `npx wrangler secret put` directly: it immediately deploys a new Worker version.
5. Stage **exact values** in both `authichain-com` (checkout + verifier) and `authichain-edge-router` (Checkout API + webhook):
   - `X402_PACK_PRICE_ID=price_1UZdq5GqTruSqV8TsaDtFBPF`
   - `X402_PACK_CREDITS=120`
   - `X402_PACK_ENABLED=true` **only after** migration, code, security and worker smoke tests pass.
   Use `wrangler versions secret put` / save version and deploy the exact approved version through the protected workflow. Do not overwrite other bindings.
6. Read-only checks: GET confirm page (200 after enable); GET /api/x402/health (200); an unpaid x402 POST still yields its normal USDC 402 quote; a malformed prepaid body must return 400 without spending.
7. Prove the paid flow with a consented external buyer in live mode (never charge the founder/test card for evidence): check paid session, one grant, receipt, API key verified against confirmed buyer email, one decrement from 120 to 119, replay no double decrement, and 120th then exhausted call. Prove refund disables unspent credits. The first real buyer is not verified until this evidence exists.
8. Capture actual deployed code SHA, Cloudflare version/deployment IDs, Stripe event/session IDs, database row IDs, native CI run links and independent review. Missing evidence is BLOCKED, not GO.

## Rollback / kill

- Remove or set `X402_PACK_ENABLED=false` in a **controlled Worker version** to block new pack Checkout and prepaid verification. Existing x402 USDC remains unaffected.
- Preserve grants/spends and Stripe records for reconciliation; do not delete purchase evidence or refund rights.
- Do not enable public copy or offer promotion until customer fulfillment is independently proven.

**Current evidence:** Live Stripe price exists. New code and SQL are staged only on a GitHub branch, not merged, not migrated, not active or deployed. No new charge, checkout session, customer credit or verification debit has been attempted.
