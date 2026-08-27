# Status: DEPLOYED (via CI) — secrets unverified

**Updated:** 2026-08-27, correcting the 2026-04-27 "not deployed" status below,
which is now false: the worker exists on the project's Cloudflare account
(`4c1869b9…`, confirmed via the Cloudflare API) running current code (includes
the Telegram→email delivery fallback), and `authichain-license-issuer` is in
the `.github/workflows/deploy-workers.yml` matrix, so it redeploys on every
push to `main` that touches this directory.

D1 (`authichain-license-db`) and the `LICENSE_SESSIONS` KV namespace referenced
in `wrangler.toml` both exist with IDs matching the file. The D1 database had
**0 tables** as of 2026-08-27 (migration `migrations/0001_initial.sql` was
never applied) — applied it directly via the Cloudflare D1 API; `licenses` and
`stripe_events` now exist with their indexes, both empty (0 rows).

**Still unverified — needs someone with Cloudflare dashboard / `wrangler`
access to confirm:**

- Whether `STRIPE_WEBHOOK_SECRET` and `LICENSE_PRIVATE_KEY_PEM` (both required
  by the deployed code — `checkout.session.completed` fails without them) are
  actually set as Worker secrets. No tool available in this pass could check
  secret existence (only set/list-namespace tools, not `wrangler secret list`).
- Whether a Stripe webhook endpoint is registered pointing at
  `POST /api/license/stripe-webhook` on this worker's URL, and with which
  events. `stripe_events` being empty is NOT proof either way: it's consistent
  with "no traffic yet" and with "traffic arrived but failed" equally, because
  `stripeWebhook` returns `202 accepted` to Stripe _before_ the background
  `ctx.waitUntil` processing runs — a missing secret or a DB write failure
  inside `handleEvent`'s try/catch is swallowed into a `stripe_events` row
  that, until this fix, couldn't even be written. Historical failures here
  would have been invisible from Stripe's side (200 OK either way) and left no
  trace in this DB. Worth checking Stripe's own webhook delivery log for this
  endpoint before assuming nothing has hit it.

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md` (original scaffold
decision — deployment state described there is superseded by this update)
