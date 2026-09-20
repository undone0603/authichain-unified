# Stripe webhook signing secret — live bind path

**Do not put `whsec_` values in git, PRs, or `workflow_dispatch` inputs.**

Live Stripe endpoint `we_1UGTCSGqTruSqV8ThM9bXVWp` (signing secret reminted
2026-09-16) POSTs:

`https://authichain.com/api/stripe/webhook`

That route is **`authichain-edge-router`** (`worker-app/index.ts` →
`handleStripeWebhook`). #1084 switched verification to `constructEventAsync`;
a remaining 400 `No signatures found matching the expected signature for payload`
means **none of the bound Worker secrets match this endpoint’s current Dashboard
secret**. The handler does not prefer a test secret; it tries every configured
candidate. The body is the raw POST bytes (not re-JSON’d).

## Secret names (handler)

| Env name on the Worker                         | Used for                                      |
| ---------------------------------------------- | --------------------------------------------- |
| `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`             | authichain.com (`shared/brands.ts`)           |
| `STRIPE_WEBHOOK_SECRET`                        | fallback + qron / strainchain / govchain      |

`hydrateProcessEnv` copies those Cloudflare **Worker secrets** onto
`process.env`. `getWebhookSecretCandidates` reads both names and tries each
value until one verifies.

## Where they are **not** updated

| Path                                         | What it actually binds                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| `.github/workflows/deploy-cloudflare.yml`    | Deploys `authichain-edge-router`. **Does not** put `STRIPE_WEBHOOK_*`. |
| `.github/workflows/deploy-edge-worker.yml`   | `STRIPE_WEBHOOK_SECRET` → **`authichain-revenue-worker`** only |
| `scripts/push-secrets-to-cloudflare.sh`      | Now includes `authichain-edge-router` + both names (local `.env`) |
| Vercel                                       | Not the live destination                                    |

A successful `deploy-cloudflare.yml` after #1084 only proves the Worker
**code** is current. Secrets persist across deploys until you `wrangler secret
put` (or run the bind workflow below).

## Owner steps (after a Dashboard remint)

1. Stripe Dashboard → Developers → Webhooks → **`we_1UGTCSGqTruSqV8ThM9bXVWp`**
   → **Reveal signing secret**. Copy the `whsec_…` for this endpoint only.
2. Put that value on **`authichain-edge-router`** (pick one path):

   **A. Cloudflare Dashboard**  
   Workers → `authichain-edge-router` → Settings → Variables and Secrets →
   add/edit encrypted:

   - `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` = (paste)
   - `STRIPE_WEBHOOK_SECRET` = same paste **unless** you still have a separate
     brand endpoint that must keep its own secret (then set AUTHICHAIN only)

   **B. Local wrangler** (`printf`, not `echo` — `echo` stores a trailing
   newline and HMAC fails):

   ```bash
   printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_AUTHICHAIN_SECRET --name authichain-edge-router
   printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --name authichain-edge-router
   ```

   **C. GitHub → Cloudflare sync**  
   Repo **Settings → Secrets and variables → Actions**: set
   `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` and (optional fallback)
   `STRIPE_WEBHOOK_SECRET` to the same Reveal value. Then **Actions → Bind
   Stripe webhook signing secrets → Run workflow**. The job copies those
   GitHub secrets onto `authichain-edge-router` with `printf`. It will not
   invent or roll a Dashboard secret.

3. Also keep GitHub Actions secrets in sync so a later local
   `push-secrets-to-cloudflare.sh` / rotate script does not re-bind a pre-remint
   value.
4. Stripe Dashboard → that endpoint → **Resend**
   `evt_1UHERPGqTruSqV8TMtUYKAF0`. Expect **2xx**. Replay of
   `checkout.session.completed` is idempotent on Checkout Session id.

Do **not** roll the Dashboard signing secret from code. Do **not** point the
endpoint at Vercel or `authichain-revenue-worker`.

## How to read a still-failing 400

The Worker 400 body appends presence flags only (never values), e.g.

`…payload (STRIPE_WEBHOOK_SECRET=set, STRIPE_WEBHOOK_AUTHICHAIN_SECRET=missing)`

- Both `missing` → bind the Reveal secret (this doc).
- `set` but still signature mismatch → bound value is not the reminted
  `we_1UGTCS…` secret (stale, wrong endpoint, or a trailing newline from
  `echo | wrangler secret put`). Re-put with `printf` / this workflow.
