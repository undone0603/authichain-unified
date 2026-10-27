---
name: revenue-operator
description: >-
  Use when the AuthiChain revenue goal is active, or the user says
  "revenue cycle", "do we have a subscriber", "founder payout", or
  asks to generate recurring revenue.
---

# Revenue operator

Money truth is `classifyRevenue` in `scripts/revenue-operator.ts`. Founder addresses live in `DEFAULT_FOUNDER_EMAILS` in that file. The $10 self-test does not qualify.

## Cycle

1. `checkMoneyRails` — GET `/checkout/starter` 200, GET `/checkout/dpp_readiness` 200, GET the Starter `buy.stripe.com` Payment Link 200, HEAD `/api/checkout/dpp` 204. Do not GET `/api/checkout/dpp` without `?email=`. Farm is not the public money rail.
2. `classifyRevenue` on livemode subscriptions, payouts, and charges.
3. `decideOperatorAction`. `wait_buyer` means stop.
4. Send only when the action is `send_one`. That requires `classifySend` (verified-inbox skill). HubSpot / Airtable / Apollo rows go through `scripts/revenue-crm.ts` first (crm-named-humans skill). They are not cash.
5. `mayDispatch` and `mayDisableOutreachApproval` stay closed on frozen workflows and `REQUIRE_OUTREACH_APPROVAL=false`. Do not run AgentZ `--mode auto`.
6. Do not add `$QRON` to x402 `accepts[]` or run a live buyback.

CLI: `pnpm exec tsx scripts/revenue-operator.ts decide --snapshot=path.json --skip-rails`

If the action is not `qualifying` or `send_one`, stop. Do not invent a charge.
