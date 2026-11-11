---
name: revenue-operator
description: >-
  Use for AuthiChain / Signal first real buyer, revenue-cycle, subscriber
  checks, outside-income reporting and autonomous profitable growth goals.
---

# Revenue operator — outside demand before automation

## North star

Turn the live offers into **independently attributable, settled, fulfilled,
repeat purchases with positive net contribution**, then reinvest *realized*
surplus only within existing spending authority. Do not declare daily income
because a server, catalog, workflow, or test is green.

There are **two separate tills**:

1. **AuthiChain unified** — Stripe checkout (Starter $29, DPP workspace $299,
   optional truthful catalog products); paid line-item → signed webhook →
   durable grant → usable fulfillment. Track verified provider receipts,
   fulfillment, refunds, costs, and genuine renewals. Internal active
   subscription rows, demo charges, pending payouts, and redirect pages
   do not prove paid income. See #2264, #2411, #2415, #2402.
2. **Signal shop** — https://signal.authichain.com is a separately operated
   Node/x402 Base USDC seller. The user-reported 2.2.0-paper product is the
   0.01 USDC ranked TAPE ($PEPKIN), discovery SKU **10000 atomic**. Public
   GET /api/x402/discovery (402), GET /offer (buy card), GET /health.live
   (idle discovery/10000) are discovery surfaces, *not* revenue proof.
   The authoritative external-sales till is **revenue.outside**, not the
   full treasury/house till. A prior note of 7 outside payers / 9 payments
   / $0.39 gross is **UNVERIFIED — not revenue, not MRR.** Do not merge
   those figures into Stripe customers or estate MRR. Signal USDC stays
   separate.

## Safe operating cycle

1. Run `node scripts/revenue/verify-demand.mjs` for public, read-only
   surface checks (Starter/DPP pages, Starter `buy.stripe.com` Payment
   Link, Signal `/offer` + discovery 402 + `/health.live`). It
   deliberately reports outside income and net income as `unverified`;
   even a green probe proves discoverability only. Offer/discovery must
   show **both** 0.01 USDC **and** 10000 atomic plus TAPE / `$PEPKIN`
   identity (not English "ranked tape"). `/health.live` must show the
   same identity.
2. For AuthiChain, inspect `checkMoneyRails` in
   `scripts/revenue-operator.ts`: GET `/checkout/starter` 200,
   GET `/checkout/dpp_readiness` 200, GET the listed Starter Stripe
   Payment Link 200, HEAD `/api/checkout/dpp` 204. **Never GET the
   anonymous DPP checkout API**, and Farm is not a public money rail.
   The Node probe includes that same Payment Link GET so skill, Rhai,
   and `verify-demand.mjs` stay aligned.
3. Reconcile live provider settlement with the actual SKU and **idempotent
   fulfilled entitlement**. `classifyRevenue` in
   `scripts/revenue-operator.ts` is a *legacy triage signal*, not
   authoritative net profit or proof of a paid renewal; its current
   acceptance of non-founder active/past_due/trialing subscriptions is
   insufficient on its own. Require matched paid invoice/session and grant.
4. Reconcile Signal `revenue.outside` from the shop's own live data with
   independent buyer attribution, distinct on-chain settlement IDs
   (`X-Payment-Tx`), exact TAPE fulfillment, reversals, and operating fees.
   Never infer an outside payment from a public 402 or a wallet transfer.
5. If no qualifying outside sale is freshly proved, optimize a **free**
   acquisition bottleneck: truthful public discovery, correct buy card,
   direct-URL agent reachability, independent integration and inbound buyer
   interest. Coinbase curated `x402_resources` listing is **unconfirmed**;
   do not claim inclusion. PayAI signatures were reported exhausted; do
   not fabricate replenishment or purchases.
6. Track 7-day rolling net contribution and repeat outside buyers. A
   sustained $1/day *net* requires actual costs, fees, refunds, and
   independent purchase evidence for every day. Growth milestones of
   $10/day and $100/day are goals, not income forecasts.

## Guardrails

- **No house self-pay**, founder/test-mode revenue, wash trading, artificial
  demand, circulating treasury funds, or speculative yield compounding.
- Do not restart a treasury compound process merely to move funds.
- No unauthorized payments, transfers, leverage, paid promotions, production
  deployments, secret changes, or changes to `humanHold` /
  `production_send=false`. Preserve protected-release exact-head tests and
  eligible independent review before merges or deployments.
- `decideOperatorAction` and `classifySend` can nominate one published,
  qualified contact, but **do not send** on that decision alone. `mayDispatch`
  blocks frozen outbound workflows; `mayDisableOutreachApproval` and
  `mayRunAgentzAuto` must remain closed. No guessed/role/government inboxes,
  no unapproved automatic outreach, no `$QRON` x402 acceptance or buybacks.
- Missing/stale/unsupported evidence is **UNKNOWN**, never zero or success.
  Every report needs the observed UTC timestamp, source, and limitations.
- If no authorized positive-expected-return use exists, keep liquid surplus
  intact. Do not expend capital to meet a utilization target.

## Next verified milestone

Secure **the next new non-founder independently settled and fulfilled
purchase**, first on the already-operating 0.01 TAPE direct-URL path or the
existing approved AuthiChain checkout. Record its source-specific proof,
actual net contribution and a repeat-purchase hypothesis. Expand autonomous
execution only after the corresponding control and test evidence exists.

Legacy CLI, for triage only:
`pnpm exec tsx scripts/revenue-operator.ts decide --snapshot=path.json --skip-rails`.
