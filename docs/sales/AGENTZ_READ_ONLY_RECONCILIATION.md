# AgentZ commercial evidence and connector readers

**Draft only. No external calls are made by the pure classification module.** The companion read-only adapters must be given authorized, scoped host connector handles.

## Native tests, Node >=22
```sh
node --test scripts/ci/agentz-qualification-to-win.test.mjs scripts/ci/agentz-strict-evidence.test.mjs scripts/ci/agentz-connector-readers.test.mjs
```
The original early gate has a weaker placeholder-evidence model; production commercial decisions must use `assessStrictWin` in `agentz-strict-evidence.mjs` and independent verification of input provenance. Do **not** treat passed synthetic tests as real transactions.

## Source and verification mapping
- HubSpot: `get_crm_objects`, DEAL id. A stage or quoted amount does not establish purchasing authority.
- Airtable: `list_records_for_table` with an exact base/table/record ID and readable field IDs; DNC and outbound history control suppression.
- Gmail: `search_emails` restricted to attributable inbound buyer address. Message sender and body require independent interpretation; autoresponders never qualify. The sample adapter does not read individual message bodies or authenticate email headers.
- Stripe: read-only `GetCheckoutSessionsSession`, `GetPaymentIntentsIntent`, `GetBalanceTransactionsId`, `GetPayoutsPayout`. Resolve these API operation IDs from the live authorized Stripe context first. A Checkout Session cannot establish settlement without the linked PaymentIntent and charge; a paid payout is not proof of any specific customer's order without reconciled transaction inclusion and external bank evidence.
- Bank settlement and accepted client artifact are external inputs, not available through the adapters in this PR. They MUST be independently corroborated.

## Important limitation
`sourceSystem`, `verified`, `sourceId` and `observedAt` are caller-supplied labels. These are **not cryptographic proof**. A malicious caller could supply a complete forged synthetic record and obtain `WIN_VERIFIED`; never feed untrusted raw data straight into the classifier. Host integration MUST check trusted connector origin and signed/authoritative evidence, immutable order linkage, bank reconciliation, and buyer authorization before recording any financial result. Never auto-close CRM or issue a charge based on the classifier alone.

## Client sandbox
A separate no-dependency local MCP/A2A subset is distributed as the client evaluation kit. It binds to localhost and uses synthetic data and bearer-auth rejection checks. It has not achieved independent, production protocol conformance, OAuth hardening, or regulated hardware clearance.

## Production invariant
Zero discretionary spend; no direct-main push; no new invoice, payment, email, or CRM status mutation; no production deployment; no weakening `humanHold`, `production_send=false`, `OWNER_LIVE_SEND=false`, required checks or SHA-pinned release. A qualified lead, received reply, or $0 Stripe session is not revenue. Qualified WIN requires independently attributable, settled, accepted fulfillment and bank payout.
