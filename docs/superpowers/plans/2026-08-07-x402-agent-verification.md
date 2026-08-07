# Plan: pay-per-call verification for autonomous agents (x402)

**Created:** 2026-08-07 · Implements Move 2 of `docs/strategy/INDUSTRY_LEADERSHIP_STRATEGY.md`.
**Status:** specified, not built. See "Why this is a plan and not a diff" at the end.

## The position

Incumbents in brand protection (IBM TrustChain, Avery Dennison atma.io) sell six-figure
annual contracts through field sales. A $0.03 pay-per-call endpoint with no contract, no
procurement, and no human in the loop is not a feature they can bolt on — it contradicts
their pricing model, their sales compensation, and their buyer's procurement process. That
is what makes this defensible rather than merely differentiated: not that they *haven't*
done it, but that doing it costs them their existing business.

AuthiChain already has the parts: edge workers in 300+ locations with sub-50ms cold starts,
an MCP server at `server/mcp/`, a `$QRON` ERC-20 on Polygon, Stripe metered billing, and a
`fee_flows` table. `src/app/api/verify/route.ts` exists. **`src/app/api/x402/` contains only
`health/` — the paywall itself is unbuilt.**

## Build order

The order matters more than the pieces. Do not reorder.

### 1. Spend caps and rate limits — *first, before any payment path*

An agent-payable endpoint without caps is an unbounded liability: a looping agent, a bug, or
an attacker with a funded key can spend without limit and generate unbounded infrastructure
cost. Ship this before anything can pay.

Per API key: requests/second, requests/day, and a hard cumulative spend ceiling. Reject with
`429` on rate, `402` with a "cap reached" body on spend. Caps belong in the key record,
enforced at the edge, checked before any settlement attempt — never advisory, never
best-effort. The repo already has `docs/superpowers/plans/2026-07-29-guardrail-caps-layer.md`;
reuse that layer rather than building a parallel one.

### 2. x402 paywall in front of `/api/verify`

Standard flow: unpaid request → `402 Payment Required` with payment requirements in the
response → client settles → retries with a payment proof header → server verifies settlement
→ serves the verification.

- **Rail:** USDC on Polygon as the default. `$QRON` accepted as an alternative with a
  staking discount (the tiers are already modeled in `stripe-products`).
- **Price:** `$0.03`–`$0.49` per verification, matching the per-auth economics already in
  `REVENUE_STRATEGY.md` — Enterprise-tier marginal cost at the floor, Starter at the ceiling.
  **This number is an operator decision; the code should read it from config, not a literal.**
- **Idempotency:** a settled payment must not be replayable for a second verification. Key
  settlement proofs and reject reuse — `docs/superpowers/plans/2026-04-27-webhook-idempotency.md`
  has the existing pattern.
- Keep Stripe metered billing in parallel for fiat customers. Agent-payment standards are
  early; do not bet the company on which rail wins.

### 3. A free tier with a real number

Something like 1,000 verifications/month, no card, no contact form. Agent adoption is
developer adoption and friction kills it. The free tier is the distribution mechanism, not a
loss leader — it is how `authichain.verify(...)` ends up in someone's agent before anyone
has a procurement conversation.

### 4. Publish the MCP server

`server/mcp/` already exists with a manifest. Publish to public MCP registries and agent
tool directories so adoption is one line. This is the actual go-to-market: distribution
through tool directories rather than through outbound sales.

### 5. Surface per-agent spend

`fee_flows` already records flows. Expose per-key spend and revenue in the dashboard. Both
sides need this — you need the revenue view, and the agent's owner needs to see what their
agent is spending or they will not fund it.

## The honest caveat, stated publicly

Fully autonomous *execution* is real: a funded agent pays per call with no human in the
loop. But a KYC'd legal entity must fund and own the wallet, and that is where compliance
lives. The accurate framing is **autonomous at runtime, one-time human setup, guardrails
throughout.**

State this plainly in the docs rather than implying frictionless anonymous agent payments.
It is the version that survives a security review, and — given everything in Move 0 of the
strategy doc — understating rather than overstating is now the house style.

## Why this is a plan and not a diff

This is roughly a week of engineering, and two decisions in it are the operator's, not
mine: the price per verification, and whether `$QRON` settles alongside USDC or the token
stays out of the paid path entirely. A payment path built on guessed answers to those is
worse than no payment path, because it ships something that has to be unwound after money
has moved through it.

The caps layer (step 1) is the exception — it is unambiguously correct, has no pricing
dependency, and is worth building whether or not the rest proceeds.
