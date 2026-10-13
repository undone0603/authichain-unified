# Funnel health

Checked 2026-10-13. No traffic or payments were created.

| Step | Result | What was checked |
| --- | --- | --- |
| Traffic | PARTIAL | Public pages answered. No analytics source was read. |
| Landing | PASS | authichain.com pricing and `/battery-passport`, qron.space/generate, strainchain.io/pricing, and govchain.us returned 200. |
| Action | PARTIAL | The DPP confirm page loads. `POST /api/sales` is 404 in production and READY on this branch. |
| Verification | PASS | `GET /api/verify?id=polygon-anchor-1` returned a verifier payload. `source` was `published_example`. The Agent Browser only links this endpoint. It does not invent a verdict. |
| Checkout | PASS | `GET /checkout/dpp_readiness` returned the confirm page for the $299 workspace. The HTML did not include a raw `buy.stripe.com` link. |
| Payment | BLOCKED | No Checkout Session was opened and no card was charged. |
| Provisioning | BLOCKED | Depends on a paid webhook that was not sent. |
| Activation | BLOCKED | Depends on provisioning. |
| Retention | BLOCKED | No customer session was created. |

Attribution on the new sales reply uses the checkout gate's existing query keys: `utm_source=authichain`, `utm_medium=sales_api`, `utm_campaign=battery-passport` for `dpp_readiness`, and `utm_content` set to the public plan id. Those keys are already copied into Stripe metadata by `CHECKOUT_CARRY_KEYS`.
