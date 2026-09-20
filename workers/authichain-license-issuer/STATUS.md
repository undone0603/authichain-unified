# Status: DEPLOYED (via CI) — secrets must be probed, not assumed

**Updated:** 2026-09-20.

The worker is in `.github/workflows/deploy-workers.yml` and redeploys on
push to `main` that touches this directory. D1 `authichain-license-db`
(`7757b9f2-d25f-4561-866b-37392d5cb660`) and KV `LICENSE_SESSIONS` exist.

This worker has **no `[[routes]]` in wrangler.toml**, so Stripe can only
reach it on the workers.dev URL (or a route attached in the dashboard).
The live AuthiChain money webhook remains `POST https://authichain.com/api/stripe/webhook`
on `authichain-edge-router`. A paid Agent Browser session will **not**
write a D1 license until a Stripe endpoint is registered at:

`POST https://authichain-license-issuer.<account>.workers.dev/api/license/stripe-webhook`

(or an equivalent custom route). Do **not** live-charge to find out.

## Checkable health (no Stripe charge)

After deploy:

```
curl -sS https://authichain-license-issuer.<account>.workers.dev/health
curl -sS https://authichain-license-issuer.<account>.workers.dev/api/license/health
```

JSON reports binding **presence** only (`true`/`false`), never secret
values. `ok: true` / HTTP 200 means `DATABASE`, `STRIPE_WEBHOOK_SECRET`,
and `LICENSE_PRIVATE_KEY_PEM` are bound. HTTP 503 means a paid session
cannot write a license yet.

Required for a D1 write on `checkout.session.completed`:

- `STRIPE_WEBHOOK_SECRET`
- `LICENSE_PRIVATE_KEY_PEM`
- D1 `DATABASE`
- customer email on the session (guest checkout without email is now a
  **500** so Stripe retries, not a silent 200)

Optional: `STRIPE_SECRET_KEY` (read-only retrieve to expand `line_items`
when the webhook payload omits them — not a charge), Telegram / Resend
for key delivery.

## Code fixes in this pass

- Webhook processes **before** answering Stripe (no `waitUntil` ack).
- Missing signing/webhook secrets → 503, not a fake 200.
- `checkout.session.completed` no longer no-ops when `customer` is null
  if an email is present (`stripe_customer_id` falls back to `email:…`).
- Price ID is taken from metadata, `line_items`, or a Stripe **GET**
  retrieve with `expand[]=line_items`.
- Idempotency ignores prior `error` rows so a retry can still insert.

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md`
