# Funnel health

Checked 2026-10-13. No traffic or payments were created.

| Step | Result | What was checked |
| --- | --- | --- |
| Traffic | PARTIAL | Public pages answered. No analytics source was read. |
| Landing | PASS | authichain.com pricing and `/battery-passport`, qron.space/generate, strainchain.io/pricing, and govchain.us returned 200. |
| Action | PARTIAL | The DPP confirm page loads. `POST /api/sales` is 404 in production and READY on this branch. |
| Verification | PASS | `GET /api/verify?id=polygon-anchor-1` returned a verifier payload. `source` was `published_example`. The Agent Browser only links this endpoint. It does not invent a verdict. |
| Checkout | PASS | `GET /checkout/dpp_readiness` returned the confirm page for the $299 workspace. The HTML did not include a raw `buy.stripe.com` link. |
| Checkout measurement | READY | This branch records a declared growth event on the confirm page, and `dpp_loop:checkout_started` only after Stripe returns a Checkout URL. A failed write does not change the 303. Production does not record that stage until this branch is on `main`. No session was opened for this check. |
| Payment | BLOCKED | No Checkout Session was opened and no card was charged. `POST /api/sales` returns a catalogue URL. It does not open Stripe. |
| Provisioning | BLOCKED | No paid webhook was sent, and this branch is not on `main`. The branch handler stores `profiles.last_grant_session_id`. The same session does not reset `generations_used` or resend access. A failed grant read or entitlement write returns `upsert_failed`, and the webhook answers 500 so Stripe retries. |
| Activation | BLOCKED | Payment is not activation. `activateDppMerchant` records `dpp_loop:merchant_activated` once per paid session after the buyer submits categories, markets, and labeling. First product use is `dpp_published` or `verification`. Neither event was produced for a customer. |
| Retention | BLOCKED | No customer reached a usage horizon. `GET /api/cron/dpp-exceptions` already calls `recordEarnedRetention`. A paying visit is `dpp_loop:retained` only when a publish or verification timestamp is at least 7 days after `merchant_activated`. No retention email was added. |

Attribution on the new sales reply uses the checkout gate's existing query keys: `utm_source=authichain`, `utm_medium=sales_api`, `utm_campaign=battery-passport` for `dpp_readiness`, and `utm_content` set to the public plan id. Those keys are already copied into Stripe metadata by `CHECKOUT_CARRY_KEYS`.
