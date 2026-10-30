# Payment-to-access proof gate (Cloudflare-first)

**Status: NOT SATISFIED until an independently verified deployed Worker revision and an isolated, persisted end-to-end test are both observed.** A READY Vercel deployment, a green mock unit test, a Stripe Sync Engine record, or a free checkout cannot satisfy this contract.

## Non-production component proof

Run `pnpm exec vitest run src/lib/signed-webhook-entitlement-access.proof.test.ts` on the exact PR head.

The test uses the **real Stripe SDK** to sign a TEST-MODE Checkout event with a dummy local secret; the production `constructStripeEventAsync` verifier; the real `handleStripeWebhook` handler; the production `provisionPurchase` logic; a **stateful in-memory profiles fake**; and real `checkCredit` / `deductCredit` access functions. It tests a stored session id, 100 Starter credits, an authorized spend (99 remaining), signature tampering rejection and duplicate-grant suppression. The direct-component test also rejects a $0 fixture; the **actual handler's zero-total negative case is TODO**, tracked by held PR #2149, and is not claimed fixed.

This proves **local handler/component integration only** if CI passes on the exact SHA. It does NOT call the deployed Cloudflare Hono route, write a real Supabase database, or prove actual customer login or image generation. The handler uses a non-`evt_test_` dummy fixture ID to avoid its intentional dashboard-test short circuit.

## Verified deployed Worker revision — independent read-only evidence

The configured canonical receiver is `POST https://authichain.com/api/stripe/webhook`, routed in `worker-app/wrangler.toml` to the `authichain-edge-router` Worker. **Do not infer the deployed revision from `main`, a successful GitHub run, or the Vercel project SHA.**

From a **previously authorized Cloudflare account/session** (do not print tokens, use a read-only-scoped credential if possible):

```bash
pnpm exec wrangler deployments status --name authichain-edge-router --config worker-app/wrangler.toml --json
pnpm exec wrangler deployments list --name authichain-edge-router --config worker-app/wrangler.toml --json
pnpm exec wrangler versions list --name authichain-edge-router --config worker-app/wrangler.toml --json
```

Record the active version ID(s) and traffic split, timestamp, Worker name, route ownership, and a trusted **source/build provenance association** between each version and an exact Git SHA or immutable artifact digest. A version ID without a verified source mapping is not an independently proven source revision. Do not modify routing or deploy while collecting evidence. Cloudflare Workers deployments may serve two versions simultaneously; test every serving version or refuse the proof claim.

## Execution-specific staging findings (2026-10-29)

- Cloudflare already has `authichain-staging` with only `APP_ENV` / `ASSETS` bindings. It has **no Stripe/Supabase test bindings**, so its existence is not a test receiver.
- Cloudflare already has an isolated, empty `authichain-staging-db` **D1** database. That is not a substitute for the real fulfillment store: production `provisionPurchase` writes **Supabase `public.profiles`**, while the staged D1 has zero tables. Do not build an unrelated D1-only mock and claim it establishes this product path.
- Supabase QRON-v2's existing development branch reports `MIGRATIONS_FAILED` and is not a verified usable isolated backend. Creating another branch/project may incur charges; review the cost and authorization before provision.
- `server/webhooks/stripe.ts` treats any event whose ID starts with **`evt_test_` as a test-verification event and returns before purchase fulfillment**. For an isolated positive-payment **handler** test, use a uniquely named non-`evt_test_` fixture ID with `livemode:false`, a real local HMAC header, isolated TEST-only credentials and database, and the real handler. Never send it to the live endpoint. Dashboard `evt_test_` requests demonstrate signature acceptance at most, not fulfillment.
- The existing `src/lib/signed-webhook-entitlement-access.proof.test.ts` includes **both** a direct-components test and a call to the **real `server/webhooks/stripe.ts` handler** using a non-`evt_test_` signed fixture, with an isolated in-memory Supabase adapter. It still does not call the Hono Cloudflare HTTP router or a real datastore and does not prove a deployed revision. Its detached-row mock fix is a test-fixture correction, not production credit logic.
- On 2026-10-29 the production `authichain-edge-router` was redeployed to version `57761960-ecdf-4479-bd2a-4e2d2ed046c1` (100%, deployment `a3904926-0d37-4241-aaa6-4a963cdb4da2`). The earlier version 1989 is not current. Re-read deployment state immediately before any final test; the annotations alone do not prove immutable source provenance.

## Signed webhook -> actual persisted entitlement -> usable access

Only in an isolated TEST-MODE Stripe destination, a separately authorized NON-PRODUCTION Cloudflare Worker revision, and a NON-PRODUCTION data store:

1. Identify immutable source SHA, compiled artifact digest, active version ID, route, and test environment bindings. Verify nothing points to production money, secrets, or Supabase.
2. Deliver a raw, real-HMAC-signed `checkout.session.completed` TEST-MODE event with a non-founder test identity and an authorized positive-amount Starter fixture. Verify an altered body, incorrect signing secret, missing identity, and zero total **do not** create successful fulfillment.
3. Read back `stripe_events` by event ID and `profiles` by checkout session ID from the isolated database, after request completion. Confirm terminal `success` **only** when the persisted grant and expected quota exist. A 2xx response or mock call alone is insufficient.
4. Authenticate the test buyer separately and exercise the **deployed** generation/access endpoint. Confirm it accepts a legitimate test request, decrements the stored balance exactly once, and rejects a separate non-buyer identity. Do not use a test-only bypass that omits the actual auth/authorization path.
5. Redeliver the same signed event. Read back the same profile and verify no second grant, no usage reset, and no duplicate customer activation.
6. Capture redacted proof: deployment version ID, source SHA, test event ID, session ID, profile/grant marker, status, initial and post-spend quota, HTTP statuses, test execution SHA, and timestamp. Include rollback readiness and reviewer decision before any authorized deployment.

**Negative tests must fail closed.** Never replay historical production events or generate a live charge for this proof. Keep `humanHold`, `production_send=false`, signature verification, `fulfillDppPaidSession`, CODEOWNERS, and existing Cloudflare gates intact.

## Customer revenue milestone boundary

Even a passing test-mode proof is **not** evidence of a real paying customer. Count toward 3 paying customers + 1 genuine recurring renewal only after reconciling *independent*, positive-amount **live** successful payments and identifiable buyers to terminal, durable grants and usable production access, and a separately verified paid subscription renewal. Founder payments, demos, free checkouts, unpaid/trialing subscriptions and projected CRM deals do not qualify.
