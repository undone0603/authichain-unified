# Launch matrix

Checked 2026-10-13 against production HTTP and `feat/agent-browser-ui`.
Status words: LIVE, READY, FIXING, BLOCKED, INTERNAL, EXPERIMENTAL, DEPRECATED.
A row is LIVE only when this check saw the production response.

| Surface | Status | Evidence |
| --- | --- | --- |
| EU DPP workspace checkout | LIVE | `GET https://authichain.com/checkout/dpp_readiness` returned 200. Body included `dpp_readiness` and `299`, included "Not an audit", and did not include `buy.stripe.com`. |
| Battery passport offer | LIVE | `GET https://authichain.com/battery-passport` returned 200. |
| Pricing | LIVE | `GET https://authichain.com/pricing` returned 200. |
| Open record verifier | LIVE | `GET https://authichain.com/api/verify?id=polygon-anchor-1` returned 200 with `verdict: verified`, `source: published_example`, and `unknowns` including `physical_binding_not_inspected`. That id is the published example, not a customer passport. |
| QRON free generate | LIVE | `GET https://qron.space/generate` returned 200. |
| StrainChain pricing | LIVE | `GET https://strainchain.io/pricing` returned a page that links `checkout/strainchain_passport` and `$49`. The response did not contain `strainchain_farm` or `$149`. |
| GovChain home | LIVE | `GET https://govchain.us/` returned 200. GovChain has no id in `PUBLIC_PLAN_IDS`. |
| `POST /api/sales` | READY | Implemented on this branch. Production `POST https://authichain.com/api/sales` returned 404. Deploy runs on push to `main` for `workers/authichain-com/**`. |
| Agent Browser UI | READY | Local capability tests passed. No production host was verified for `apps/agent-browser`. The route refuses shell and file writes. |
| Nightstamp | INTERNAL | Not in `PUBLIC_PLAN_IDS`. The sales route will not sell it. `https://nightstamp.com` returned 200; this check did not tie that host to a catalogue checkout. |
| Farm and Theater | INTERNAL | Present in `PLANS`, absent from `PUBLIC_PLAN_IDS`. The sales route returns no checkout URL for them. |
| AgentZ `--mode auto` | BLOCKED | Not enabled by this branch. |
| Payment, provisioning, activation | BLOCKED | No Stripe session was created and no webhook was sent. |

## Blockers

1. **Production sales route.** `POST /api/sales` is 404 on authichain.com. `deploy-authichain-com.yml` and `deploy-workers.yml` deploy from `main`. This branch was not merged and `workflow_dispatch` was not run.
2. **Agent Browser host.** The UI is a Next app inside `apps/agent-browser`. Nothing in this check published it.
3. **Agent credential.** The browser session is anonymous. It may list public offers, return a catalogue checkout URL, or link `GET /api/verify`. It cannot act as an authenticated agent.
4. **Cash path.** Checkout pages load. A paid session, webhook, service order, and activation were not exercised.
