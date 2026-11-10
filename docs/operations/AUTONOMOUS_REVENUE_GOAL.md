# Autonomous revenue goal — evidence-first operating contract

**Scope:** `undone0603/authichain-unified` and its *separately operated*
Signal x402 shop. **Status:** proposal; nothing in this document enables
payments, writes to ledgers, deploys production, sends outreach or promises
continuing execution. Snapshot taken 2026-11-09/10 UTC; recheck all live state.

## Outcome, not activity

Build an unattended **discovery → real independent buyer → paid settlement →
idempotent fulfillment → repeat purchase → net income → authorized
reinvestment** loop. The first target is the next new outside purchase
with verified settlement and fulfillment. The first economic goal is seven
consecutive UTC days of **$1/day positive net operating income**, with at
least three distinct independent buyers during the window. Sustained
$10/day, then $100/day are later targets, not projections.

A self-running monitor is **not** a self-sustaining business. Revenue
requires a real buyer; positive net income requires costs and refunds.

## Source-specific evidence (never combine tills)

| System | Existing money rail | Needed to count real customer revenue | Do *not* count |
|---|---|---|---|
| AuthiChain unified | Live Stripe Starter $29; DPP workspace $299 | Non-founder live paid Stripe Checkout/charge **with matched SKU and signed webhook**, durable entitlement, successful fulfillment, unique receipt, UTC timestamp | Founder $10 test; redirect `success`; internal `subscriptions.status=active`; pending payout; historical `stripe_events.status=success` |
| Signal Node x402 | Base USDC ranked TAPE ($PEPKIN); 0.01 USDC / 10000 atomic; `GET /api/x402/discovery` 402; `GET /offer` public buy card | A new external buyer, settled and unique on-chain `X-Payment-Tx`, matching paid TAPE delivery, independent attribution in the actual `revenue.outside` ledger | House/self-pay; full treasury till; public 402 challenges; a crawler opening /offer; unfulfilled transfers |

The user reported **seven** outside payers, **nine** payments and **$0.39
gross** for Signal `2.2.0-paper`. This is an *unverified report*, not a
fresh connected ledger read and **not** AuthiChain Stripe revenue or MRR.
Signal is a different runtime and may not be deployed from this monorepo.

## Repeatable zero-charge evidence

```sh
node scripts/revenue/verify-demand.mjs
node --test scripts/__tests__/verify-demand.test.mjs
pnpm exec tsx scripts/revenue-operator.ts rails
```

The new Node probe performs only fixed public GET/HEAD calls. It fails on
unexpected HTTP status, mismatched TAPE/price identity, or inaccessible
public surfaces. It never pays a 402 challenge and explicitly reports
outside revenue, payer counts, and net income as **unverified**. A green
probe proves availability/offer plausibility, **not** real demand,
settlement, fulfillment, conversion, renewal or operating margin.

`scripts/revenue-operator.ts` is useful for legacy triage but its current
`classifyRevenue` accepts some active/trialing/past_due subscription
records without a paid invoice and returns a payout-based qualification
without receipt-level attribution. **Never use that verdict alone as
financial proof.** Before promoting any paid-revenue metric, reconcile
independent provider settlement, actual SKU, fees, refunds and fulfillment
to the same transaction.

## Near-term priority order

1. **Protect trustworthy money paths.** Hold DPP grant changes in
   [PR #2411](../../pull/2411) until native exact-head tests and
   independent review; sequence the protected edge-router release
   [PR #2415](../../pull/2415) first if its acceptance criteria are met.
   Resolve [issue #2394](../../issues/2394) environment/runner blockers.
   Do not deploy a webhook fix just because the Next.js page passes.
2. **Keep the sellable offer truthful.** Resolve checkout watchdog
   pricing-copy findings and live DPP compliance overclaims
   [#2370](../../issues/2370). Keep $299 workspace terminology honest;
   no certification or audit claim without delivery.
3. **Acquire demand on existing free routes.** Put accurate TAPE/PEPKIN
   discovery and /offer before independently operated x402 agents with
   direct URLs. Treat Coinbase curated `x402_resources` inclusion as
   *unverified*; user reports it does not yet list the shop. If PayAI
   signatures are exhausted, do not fake a signature or buy inclusion.
   Collect qualified inbound interest and reviewable, asynchronous,
   provenance-backed outreach *drafts*. Existing send gates stay on.
4. **Fulfill and retain.** For each actual outside purchase, measure
   purchase-to-delivery latency, retries, idempotency, refunds, and
   next-product utility. Add prepaid x402 packs [PR #2403](../../pull/2403)
   only after the independent native/SQL concurrency and protected-release
   evidence it explicitly requires.
5. **Reinvest net surplus, not gross receipts.** Reconcile settlement
   fees, hosting/API costs, taxes/obligations and cash reserves. Spend
   `$0` on acquisition while no credible positive-return spend is
   evidenced. No speculation, yield farming, leverage or circular
   payments. Realized surplus may only fund already authorized,
   reversible experiments.

## Cadence and decision policy

**Daily (read-only):** probe public offer health; inspect *current*,
separately authorized ledger exports and provider receipts; record UTC
observation time, source, source-SHA/deployed version, verified vs unknown,
outside buyer count, transactions, actual gross, costs and net. On an
unavailable feed write `UNKNOWN`, never `0`.

**Weekly:** choose one acquisition or conversion bottleneck, run the
lowest-cost authorized experiment, compare verified independent purchases
and net contribution against the previous window. Stop experiments with
negative measured economics; keep a reversible rollback plan. Guardrail
changes and production financial mutations remain protected.

**Autonomy:** read-only observations, tests, analysis, drafting and
evidence indexing can run unattended on allowed isolated executors.
External messages, paid spend, treasury movement, actual charges, live
production release, and restriction changes require their separate
existing authorizations. A disabled/blocked runner is a **blocked
automation**, not evidence of a running 24/7 system.

## Minimal evidence record per outside paid order

Keep proof references in restricted systems; **never publish personal
emails, provider credentials, raw payment tokens or customer identities in
a public GitHub issue**.

```json
{
  "observedAtUtc": "2026-11-09T20:00:00Z",
  "source": "signal-revenue.outside-or-authichain-stripe",
  "business": "signal-or-authichain",
  "purchaseRef": "redacted-stable-key",
  "independentBuyerProvenanceRef": "restricted-evidence-reference",
  "providerSettlementRef": "restricted-verified-reference",
  "sku": "exact-settled-sku",
  "grossUsd": null,
  "feesUsd": null,
  "refundUsd": null,
  "fulfillmentProofRef": "restricted-evidence-reference",
  "netContributionUsd": null,
  "verification": "unknown"
}
```

Unset numbers remain `null`, never fabricated. Do not change
`verification` to verified until evidence is independently reconciled.

## Definition of done

- At least one **new** independent buyer whose settled purchase and
  delivered product are verifiable, with no self-pay or circular funds.
- A full week with positive **daily net income** supported by actual
  source-specific cost records; repeat purchase opportunity measured.
- Payment failure, refunds, idempotent grants, customer support and
  recovery tested on an isolated executor.
- Monitors actually execute with timestamped evidence and safe fallbacks.
- Reinvestment proposals present expected return, downside risk,
  authority, protected reserves, and measured results.
- No promotion or success claim based on missing tests, stale ledgers,
  unreviewed deployment, or forecasts.

Related: [Launch Control #1986](../../issues/1986),
[Internal subscription proof #2264](../../issues/2264), and
[Current paid pack hold #2404](../../issues/2404).
