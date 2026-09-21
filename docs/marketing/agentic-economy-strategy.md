# Strategy: Selling to Agentic Business Operating Systems + Autonomous Microtransactions

## Positioning

**AuthiChain is the authentic agentic economy.** The house brand was already
"the Authentic Economy" (physical-product truth). The industry term is "the
agentic economy" (agents as economic actors). The join is the product: agents
can pay and call tools; they still need a machine-verifiable check that a
physical product, passport, or claim is real.

Canonical public brief: `https://authichain.com/authentic-agentic-economy`.
Wallets, chains, tokens, rails: [`docs/strategy/WEB3_IDENTITY.md`](../strategy/WEB3_IDENTITY.md).
Live agent economics: [`docs/strategy/AGENT_TOKENOMICS_x402.md`](../strategy/AGENT_TOKENOMICS_x402.md).
Human SKUs: `src/lib/plans.ts`. Do not invent AuthiChain papers. Cite public
research as context only (Xu arXiv:2602.14219; Teikari & Fuenmayor SSRN 6068907;
ERC-8004; Galaxy agentic capital markets). Live estate claims only: signed seals,
5-agent consensus, MCP tools, x402 at **$0.05 USDC on Base**, EU DPP Readiness
and Passport on Stripe.

## The thesis

AuthiChain's products are a **verification/truth layer**. Autonomous AI agents — the new
buyers — constantly need to verify authenticity, provenance, and document validity but have
no trusted way to do it. That is a near-perfect fit: **sell verification-as-an-API that agents
call and pay for autonomously, per call.** The published unit is **$0.05 USDC / call** on the
live x402 rail (`src/lib/x402.ts`). The older $0.03–$0.49 ladder in `REVENUE_STRATEGY.md` is
negotiation copy, not the agent meter.

## Three money rails (do not mix)

Canonical map: [`WEB3_IDENTITY.md`](../strategy/WEB3_IDENTITY.md).

| Rail | Buyer | Asset / SKU | Chain or processor | Status |
| --- | --- | --- | --- | --- |
| **Stripe** | Person with a card | Passport **$49** · DPP **$299** · QRON Living QR packs | Stripe | **LIVE** — `src/lib/plans.ts` |
| **x402** | Funded agent wallet | Circle **USDC**, **$0.05 / call** | **Base 8453** | **LIVE** — payTo / tokenomics EOA `0x5db5…` (`X402_PAY_TO`). Do not rebind. |
| **$QRON** ERC-20 | n/a | 1B supply, 18 decimals | **Polygon 137** | **Deployed, not a payment rail.** Do not add to x402 `accepts[]`. |

`$QRON` held by the same `0x5db5…` EOA that receives Base USDC does **not** make `$QRON` the settlement asset. govchain.us staking figures are **theater**, not circulating supply.

**What "zero human involvement" really means:** fully autonomous _execution_ is real — an agent
with a funded wallet pays per API call with no human in the loop. But a human/legal entity must
**fund and own the wallet** (KYC/AML lives at that boundary — you cannot fully escape it), and
you need **spend caps + rate limits** to prevent runaway/abuse. So: autonomous at runtime, with
a one-time human/legal setup and guardrails. That is the honest, defensible version.

## What you already have (the moat is mostly built)

- **`server/mcp/index.ts`** — MCP server. Agents discover price via `get_pricing` (points at live catalog/health) and pay via x402.
- **`src/lib/plans.ts` + Stripe webhooks** — human checkout (Passport $49 / DPP $299 / QRON packs).
- **Live x402** — `GET /api/x402/health`, unpaid `POST /api/x402` → HTTP 402, public docs `/x402`.
- **`$QRON` ERC-20 + `fee_flows`** — speculative utility / theater accounting in `src/lib/authentic-economy.ts`. Not agent settlement.

## Go-to-market to agentic operating systems

1. **Distribute the MCP server** to MCP registries / agent tool directories (Claude, Cursor,
   Smithery, etc.). Make `authichain.verify(...)` a one-line tool any agent can adopt.
2. **Agent-payable endpoint (already live):** `POST /api/x402` and `POST /api/v1/agent-verify`
   behind x402 (pay-per-call in **Base USDC only**). Stripe remains the human path.
3. **Price as one published microtransaction:** **$0.05 USDC** per verification. Do not
   publish a second hardcoded schedule. `$QRON` staking discounts stay theater.
4. **Land-and-expand:** free public verify where it is already free → metered x402 for agents →
   Stripe for humans. Same authenticity layer, three rails.
5. **Positioning**: "AuthiChain is the authentic agentic economy — verifiable authenticity that
   agents can call and pay for, per transaction."

## Concrete build sequence (to enable autonomous microtransactions)

1. **x402 paywall** in front of agent verify — **done** (HTTP 402 + Circle USDC on **Base**, not Polygon, not `$QRON`).
2. **Per-key spend caps + rate limits** — already modeled; keep failing closed.
3. Publish the **MCP server** to public registries with the paid verify tool (catalog/health for live payTo).
4. **Stripe** remains human SKUs via `plans.ts` (do not invent prices).
5. Dashboards: `fee_flows` records speculative `$QRON` theater; x402 revenue is Base USDC to `X402_PAY_TO`.

## Honest risks

- **Regulatory:** autonomous payments still require a KYC'd funding entity; treat the wallet
  owner as the legal customer.
- **Abuse:** uncapped autonomous spend is dangerous — caps/rate-limits first, always.
- **Adoption:** agent-payment standards (x402/AP2) are early; expect to support both crypto and
  metered-fiat until one wins. Live crypto rail is **USDC on Base**, not `$QRON`.
