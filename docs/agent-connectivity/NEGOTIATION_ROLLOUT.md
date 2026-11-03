# AuthiChain `/negotiate` — eighth MCP tool and rollout plan

**State on November 3, 2026:** proposed code on branch `feat/negotiate-eighth-mcp-tool-20261103`; not yet merged or deployed. Today's live MCP has seven tools. This PR adds `negotiate` as the eighth. PR #2315 independently adds `get_agent_setup_offers`; if both merge, that discovery tool would be ninth. Rebase and reconcile before either merge, and do not claim eight live tools until post-deployment `tools/list` proves it.

## Research implemented

Principled negotiation treats **BATNA** as an outside option, **reservation / walk-away values** as hard internal limits, and **ZOPA** as unknown until the other party's acceptable terms are confirmed. Multi-issue bargaining turns price, lead time, warranty, minimum quantity, setup fees and service terms into comparable weighted issues. **MESO-inspired** proposals trade among issues while aiming at similar caller utility; never present more than three offers at once or claim that the other side shares those preferences.

Primary reading:
- [Harvard Program on Negotiation: MESO, July 2026](https://www.pon.harvard.edu/daily/negotiation-skills-daily/managing-the-negotiators-dilemma-nb/)
- [Harvard Program on Negotiation: practical MESO safeguards](https://www.pon.harvard.edu/daily/business-negotiations/how-to-use-mesos-in-business-negotiations/)
- [Official MCP tool discovery and invocation, 2025-06-18](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/server/tools.mdx)
- [A2A v1.0 Agent Card and JSON-RPC](https://a2a-protocol.org/v1.0.0/specification)

This MCP server currently negotiates 2025-06-18 / 2025-03-26, not the July 2026 protocol. Modern MCP `resultType` compatibility needs a separate independent gate.

## Proposed user interfaces

| Surface | Operation | Guard |
| --- | --- | --- |
| `GET /negotiate` | Retrieve example and public metadata | No session or payment |
| `POST /negotiate` | Calculate weighted terms and 1–3 proposal packages | No outreach, contract or order |
| `POST /api/negotiate` | Alias for same function | No new billing path |
| `MCP tools/call negotiate` | Same pure calculator using an input schema | No tool-to-tool settlement |
| A2A `SendMessage` containing `/negotiate` | Explain where to submit structured terms | Does not run a commercial negotiation |

### Hypothetical replacement-parts example

```json
{
  "objective":"Plan a hypothetical replacement part purchase; do not order",
  "issues":[
    {"key":"price_usd","direction":"minimize","target":80,"walkAway":120,"weight":5,"unit":"USD"},
    {"key":"delivery_days","direction":"minimize","target":2,"walkAway":10,"weight":4,"unit":"days"},
    {"key":"warranty_months","direction":"maximize","target":24,"walkAway":6,"weight":2,"unit":"months"}
  ],
  "counterpartOffers":[
    {"id":"supplier_a","terms":{"price_usd":105,"delivery_days":4,"warranty_months":12}},
    {"id":"supplier_b","terms":{"price_usd":125,"delivery_days":3,"warranty_months":24}}
  ],
  "outsideOption":{"terms":{"price_usd":110,"delivery_days":8,"warranty_months":12}}
}
```

These suppliers and amounts are invented test inputs. The engine should mark A within declared *numerical* limits, B beyond the $120 price ceiling, and both unverified. It must return `zopa.status="UNKNOWN"`, `batna.verifiedByIndependentSource=false`, `sideEffectsPerformed=0` and `allowedActions.purchase=false`. Real parts also require an independently checked model, compatible replacement SKU, safety certification and inventory before procurement.

## Invariants

The eighth tool can **draft and score**, not **send, accept, contract, purchase, pay, sign, register identities, grant trust or publish a credential**. MCP read-only annotations are hints, not permission enforcement. Reject malformed payloads, numeric overflows, overlong content and missing terms. Do not log private price limits, full customer identities or secret-bearing content. Do not claim actual seller quotes or ZOPA from unverified caller submissions. Never increase operating spend or make a binding counteroffer using a model-generated answer.

## Function rollout — proposed and gated

| Sequence | Functions | Required evidence before activation |
| --- | --- | --- |
| 0 | `negotiate` | Node test matrix, strict worker typecheck, MCP 8-tool exact list, A2A informational test, independent review, protected deploy |
| 1 | `get_agent_setup_offers` (separate PR #2315) | Rebased tool list, consent and service scope, quote-only terms |
| 2 | `repair`, `source`, `compare` | Independent compatibility checks, licensed seller feeds, timestamped stock and quote evidence; read-only |
| 3 | `request_quote`, `counteroffer` | Authorized counterpart, rate limits, signed messages, no unsolicited mail, operator review |
| 4 | `authorize_order`, `order` | Signed user approval for exact seller, SKU, quantity, tax, shipping, price ceiling; idempotency and rollback |
| 5 | `pay`, `track`, `resolve_dispute` | Approved existing payment rail, no self-pay loopholes, actual deliveries, refund and complaint handling |
| 6 | Multi-agent negotiation pools | Verified agent identities, scoped budgets, round caps, audit trails, independent feedback and revocation |

## Autonomous research and improvement loop

Use the existing daily **Advance open-agent alliances** task: compare official MCP and A2A specs, peer feedback, current PR head and negative-case regression results. Make narrowly scoped reviewable updates only when evidence supports them. Keep a source/date/hash ledger of external claims; use bounded, approved test runners before release. Any source or code change restarts exact-head checks. **Never auto-merge without protections or deploy, spend, message third-party agents, or make agreements without authorization.**

Release definition: after protected deployment, a neutral live client independently retrieves eight distinct legacy+new tools from `tools/list` and demonstrates `tools/call negotiate` and `POST /negotiate` return compatible fail-closed results. The public A2A card can advertise negotiation planning but cannot honestly claim autonomous commercial exchange.
