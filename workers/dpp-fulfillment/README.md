# dpp-fulfillment

Stripe webhook + daily report worker for the **EU DPP Readiness Audit** ($299).

## What it does

| Trigger                      | Action                                                  |
| ---------------------------- | ------------------------------------------------------- |
| `checkout.session.completed` | Onboarding email to buyer, HubSpot deal, founder notify |
| `checkout.session.expired`   | One recovery email with payment link                    |
| Cron `0 13 * * *`            | Daily founder report (payments / emails / deals)        |

Kill switch: set KV key `sending_paused` = `true`.

## Stripe catalog (live)

| Resource     | ID / URL                                         |
| ------------ | ------------------------------------------------ |
| Product      | `prod_UwfYVM0TYpdg4J` — EU DPP Readiness Audit   |
| Price        | `price_1TwmD8GqTruSqV8TpAF8dfyA` — $299 one-time |
| Payment Link | https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c   |
| Smoke promo  | `DPP-SMOKE-E2E` (100% off, single-use)           |

## Deploy

```bash
cd workers/dpp-fulfillment
npx wrangler kv namespace create dpp-fulfillment-kv
# paste id into wrangler.toml [[kv_namespaces]]

npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put HUBSPOT_TOKEN   # optional but recommended

npx wrangler deploy
```

Then in Stripe Dashboard → Developers → Webhooks:

- Endpoint: `https://dpp-fulfillment.<account>.workers.dev/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`
- Paste signing secret into `STRIPE_WEBHOOK_SECRET`

## Smoke test

1. Open payment link, apply code `DPP-SMOKE-E2E`.
2. Confirm checkout → expect onboarding email + founder notify.
3. Optionally send a Stripe CLI `checkout.session.expired` test event.

## Related

- Landing: `workers/authichain-com` routes `/dpp` and `/dpp/thanks`
- Outreach: `scripts/dpp-outreach/`
- Design: `docs/superpowers/specs/2026-07-16-eu-dpp-revenue-machine-design.md`
