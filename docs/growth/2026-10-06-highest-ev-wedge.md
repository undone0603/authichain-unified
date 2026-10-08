# Highest-EV wedge — 2026-10-06

Status: draft. Not live. No prices changed. No mail sent.

## Markets scored

Rubric (0–5), growth-loop rules: live checkout, external deadline, self-serve (no call), defensible claim, existing distribution, AOV x estimated paid conversion, zero founder time.

| Market | Live charge | Self-serve | Claim safety | Distribution already up | Founder time | Score | EV note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EU DPP Readiness $299 | 5 — Payment Link + `/api/checkout/dpp` | 5 | 4 if copy stays readiness, not certification | 5 — `/dpp-check`, `/battery-passport`, `/p/eu-digital-product-passport-batteries` | 5 | 24 | Highest. Feb 18 2027 LMT/EV battery passport date is external. |
| QRON Starter $29 / Creator $99 / Launch $19/mo | 5 | 5 | 2 — signed verification listed in development | 3 | 5 | 15 | Impulse AOV. Not the trust-layer customer. |
| StrainChain Passport $49 | 5 — Payment Link live | 4 | 3 — must not claim METRC or a legal COA | 3 | 3 if we email | 15 | Real SKU. Prior RealTHCV reply was no. |
| StrainChain Farm $149/mo | 4 — link live, catalogue PR was draft | 3 | 3 | 2 | 2 | 12 | Zero subscriptions on the account as of 2026-09-21 brief. |
| x402 $0.05 | 4 — 402 rail live | 5 for agents | 4 | 2 | 5 | 11 | payTo balance is prior self-pay. No external payer. |
| AgentZ | 0 — control plane | 0 | n/a | 0 | 0 | 0 | Operator runtime. Not a SKU. |
| OpenClaw | 0 — owner-set gateway | 0 | n/a | 0 | 0 | 0 | Bridge. Not a market. |

## Pick

EU DPP Readiness $299 for LMT battery and e-bike brands that must place a battery passport from 18 February 2027. Entry is the free check, not a hand-written email.

Do not productize AgentZ or OpenClaw. Do not re-enable `outreach-trigger.yml`. Existo stays queued; a one-off send is not the loop.

## Loop

- Trigger: indexed visit to `/battery-passport` or `/p/eu-digital-product-passport-batteries`, or a completed free `/dpp-check` that flags LMT/EV battery.
- Mechanism: free gap result → work-email gate → Stripe Checkout for `dpp_readiness` $299 → workspace with 50 generations. Abandoned checkout recovery uses the email already collected. No call.
- Expected conversion (estimate, not a measured rate): 8–15% of check completers start checkout; 15–30% of checkout starts pay. Blended paid rate from cold SEO visit: 0.4–1.5%.
- Events: `dpp_check_completed`, `dpp_checkout_started`, `dpp_checkout_paid`, `dpp_recovery_sent`.
- Kill: 21 days after index, ≥200 check completes, 0 `dpp_checkout_paid` from non-founder email. Then stop indexing new battery URLs and do not add a second SKU.

## Proof still missing

No external paid customer. No customer logo, testimonial, or certification. The page must not invent one. First proof to collect: one non-founder `ch_` on the $299 link, then a redacted readiness file the buyer agrees to cite.

## Yes/no

Ship this page copy on authichain.com battery URLs and leave Existo unsent?
