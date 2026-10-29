# Payment-to-access proof gate (Cloudflare-first)

**Status: NOT SATISFIED until an independently verified deployed Worker revision and an isolated, persisted end-to-end test are both observed.** A READY Vercel deployment, a green mock unit test, a Stripe Sync Engine record, or a free checkout cannot satisfy this contract.

## Non-production component proof

Run `pnpm exec vitest run src/lib/signed-webhook-entitlement-access.proof.test.ts` on the exact PR head.

The test uses the **real Stripe SDK** to sign a TEST-MODE Checkout event with a dummy local secret; the production `constructStripeEventAsync` verifier; the production `provisionPurchase` logic; a **stateful in-memory profiles fake**; and real `checkCredit` / `deductCredit` access functions. It checks a stored session id, 100 Starter credits, an authorized spend (99 remaining), signature tampering rejection, duplicate-grant suppression, and rejection of $0 paid-status sessions.

This proves **component wiring only** when the job passes. It does NOT call `server/webhooks/stripe.ts` or the Cloudflare Hono route, does NOT prove a live database commit, and does NOT prove actual customer login or image generation.

## Verified deployed Worker revision — independent read-only evidence

The configured canonical receiver is `POST https://authichain.com/api/stripe/webhook`, routed in `worker-app/wrangler.toml` to the `authichain-edge-router` Worker. **Do not infer the deployed revision from `main`, a successful GitHub run, or the Vercel project SHA.**

From a **previously authorized Cloudflare account/session** (do not print tokens, use a read-only-scoped credential if possible):

```bash
pnpm exec wrangler deployments status --name authichain-edge-router --config worker-app/wrangler.toml --json
pnpm exec wrangler deployments list --name authichain-edge-router --config worker-app/wrangler.toml --json
pnpm exec wrangler versions list --name authichain-edge-router --config worker-app/wrangler.toml --json
```

Record the active version ID(s) and traffic split, timestamp, Worker name, route ownership, and a trusted **source/build provenance association** between each version and an exact Git SHA or immutable artifact digest. A version ID without a verified source mapping is not an independently proven source revision. Do not modify routing or deploy while collecting evidence. Cloudflare Workers deployments may serve two versions simultaneously; test every serving version or refuse the proof claim.

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
