---
name: revenue-operator
description: >-
  Use when the AuthiChain revenue goal is active, or the user says
  "revenue cycle", "do we have a subscriber", "founder payout", or
  asks to generate recurring revenue.
---

# Revenue operator

Money truth is `classifyRevenue` in `scripts/revenue-operator.ts`. A paid livemode charge is a first sale and qualifies. Founder addresses live in `DEFAULT_FOUNDER_EMAILS` in that file. Founder-only _subscriptions_ still do not qualify.

## Cycle

1. `checkFarmRails` — Payment Link GET 200, Farm HEAD 204. Do not GET `/api/checkout/dpp` without `?email=`.
2. `classifyRevenue` on livemode subscriptions, payouts, and charges.
3. `decideOperatorAction`. `wait_buyer` is a gate: unlock outreach or take `send_one`. It is not done.
4. Send only when the action is `send_one`. That requires `classifySend` (verified-inbox skill). HubSpot / Airtable / Apollo rows go through `scripts/revenue-crm.ts` first (crm-named-humans skill). They are not cash.
5. `mayDispatch` allows `b2b-outreach`, `outreach-trigger`, `dpp-outreach-trigger`, and `pipeline-tick`. `gov-mint` stays frozen. `REQUIRE_OUTREACH_APPROVAL=false` stays closed. Do not run AgentZ `--mode auto`.
6. Do not add `$QRON` to x402 `accepts[]` or run a live buyback.

CLI: `pnpm exec tsx scripts/revenue-operator.ts decide --snapshot=path.json --skip-rails`

Do not invent a charge. A first paid sale already in livemode is enough.
