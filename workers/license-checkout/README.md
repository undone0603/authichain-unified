# OEM-VERIFY and PACK-WORKFLOW Checkout

This adapter prepares Stripe-hosted checkout using the three approved live
catalog prices. It does not implement or claim to implement the OEM verification
service or the commercial workflow bundle. It refuses to create checkout
sessions unless the actual fulfillment service reports the requested deliverable
ready. Production checkout and the public Worker URL default off.

## Approved pricing

| SKU | Initial payment | Later payments |
| --- | --- | --- |
| OEM-VERIFY | $7,500 setup + $1,500 first month = **$9,000** | $1,500/month |
| PACK-WORKFLOW | $1,500 | None |

The OEM Checkout Session uses `mode=subscription` with one setup and one monthly
line item. Stripe includes the one-time price only on the initial invoice. This
adapter creates no trial, discount, annual commitment, tax policy, or exclusivity
term. The existing catalog and fulfillment webhook are not repointed.

The three live prices were created and read back on October 31, 2026. They are
resolved using stable lookup keys in source; their actual price IDs and Stripe
credentials are not committed. The binding names are `STRIPE_PRICE_OEM_SETUP`,
`STRIPE_PRICE_OEM_MONTHLY`, and `STRIPE_PRICE_PACK`.

## Secure binding

`scripts/bind-secrets.mjs` runs on an approved host that already has
`STRIPE_SECRET_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` securely
injected. It refuses to run if `license-checkout` is absent. It retrieves the
prices by lookup key and validates currency, amount, active state, live/test
mode, and monthly interval before binding the API key and three price IDs.
It prints names only. Values never enter source files or workflow inputs.

```sh
# Validation only; no mutation.
node --experimental-strip-types workers/license-checkout/scripts/bind-secrets.mjs
# Bind the four values only when using approved injected credentials.
node --experimental-strip-types workers/license-checkout/scripts/bind-secrets.mjs --apply
```

This script has been tested with simulated APIs, not run against production.
The connected Stripe app can create catalog prices but does not expose its
underlying API secret for export into a different service. The existing GitHub
binding workflows target other workers; none has been silently repurposed.
A distinct Stripe webhook endpoint also needs its own `STRIPE_WEBHOOK_SECRET`.

## Fulfillment contract — outstanding implementation

Bind `LICENSE_FULFILLMENT` to the verified delivery backend through a Cloudflare
service binding. No placeholder is configured. The backend must expose:

- `GET /ready`: `skus` keyed by the two exact SKU strings. Each has `ready:true`;
  OEM additionally has `api_access:true` and `subscription_lifecycle:true`;
  PACK additionally has `download_ready:true` and a concrete `version` string.
- `POST /fulfill`: accepts the verified Stripe event/session/customer IDs, SKU,
  subscription ID, claim hash, paid amount, and currency. It must atomically
  persist the event and exactly one license per purchase, including replay and
  concurrent-event handling, before returning `fulfilled:true` and `license_id`.
  A row alone is not evidence of usable OEM API access or a downloadable pack.
- `POST /claim`: accepts a paid session ID, SKU, and matching claim hash. It
  returns `status:pending` until the grant is usable, then `status:ready` with
  the buyer's API key/access information or the protected versioned download.
  It must prevent delivery for revoked/refunded licenses and provide a reviewed
  recovery mechanism for buyers who lose their claim token.

The OEM backend must independently process subscription renewal, cancellation,
payment failure, and refund events and enforce the resulting access state. Its
readiness flag must stay false until those behaviors are implemented and tested.
No event forwarding or subscription enforcement is implied by this adapter.

The signed checkout handler re-fetches the session and exact line items from
Stripe before asking the backend to fulfill. Unpaid completion events do not
grant access. A non-persisted or unavailable grant returns 503 for Stripe to
retry. A success redirect never grants access on its own.

## Pricing CTA and buyer delivery

Call the exported `startCheckout` browser helper from the current pricing UI:

```tsx
import { startCheckout } from "./start-checkout";

<button onClick={() => startCheckout("OEM-VERIFY", checkoutOrigin)}>
  Start OEM Pilot — $7,500 setup + $1,500/month
</button>
<p>$9,000 due initially, including the first month.</p>
<button onClick={() => startCheckout("PACK-WORKFLOW", checkoutOrigin)}>
  Get Workflow Pack — $1,500
</button>
```

The helper generates a cryptographically random buyer claim token. Only its
SHA-256 hash is placed in session metadata. Stripe's configured success redirect
carries the token in a URL fragment, which browsers do not send in HTTP requests.
The success page exchanges it with a verified paid session and the private
fulfillment backend. A session ID alone cannot retrieve the buyer's key. The
page uses no-store, no-referrer, a strict Content Security Policy, and text-only
rendering of delivery information. The claim token is sensitive; it is not a
substitute for the backend's buyer account/recovery mechanism.

These CTA snippets are prepared for integration. They are not published on the
existing pricing page while checkout is unavailable. No new hero image was
attached in this conversation; the existing page imagery has not been changed.
No patent claim, patent application number, booking link, exclusive sale, email,
CRM write, or outreach is introduced.

## Tests and launch status

```sh
pnpm --filter license-checkout test
pnpm --filter license-checkout check
pnpm exec wrangler deploy --dry-run --config workers/license-checkout/wrangler.toml
```

The local node:test suite uses actual HMACs and simulated Stripe/service APIs.
It verifies price construction, modes, readiness gating, signed payment checks,
delivery-token checks, and secret-binding redaction. It does not prove remote
deployment, production secret installation, a real paid purchase, or fulfillment.
Repository CI and a real Stripe test-mode run are required before activation.

Observed blockers on October 31, 2026: the originally named Worker/source was
absent; no concrete OEM API entitlement or PACK-WORKFLOW artifact was found in
the inspected repository, saved pricing material, or prior work. The connected
Stripe account is live-only. This change supplies the checkout adapter and
secure binding script; it does not fabricate the missing product implementation.

The next concrete input is the existing OEM entitlement implementation/API
specification and the exact versioned pack artifact to deliver. Their readiness
must be demonstrated before `CHECKOUT_ENABLED=true`, public routing, or a live
checkout session. Existing deployment controls remain in effect.
