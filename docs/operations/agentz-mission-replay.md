# AgentZ mission replay

Non-authoritative audit on 2026-10-06. This file does not change `classifyRevenue`, `src/lib/plans.ts`, or AgentZ authority. It is not a ledger and it does not store a revenue total. AgentZ `--mode auto` stays frozen. A workflow is promoted only after repeated real-world success.

Authoritative files stay the charter, `.github/autonomy.json`, `.github/founder-business.json`, `src/lib/plans.ts`, and `classifyRevenue`. Cash is a livemode Stripe charge or subscription that `classifyRevenue` accepts. A CRM stage and a Polygon Amoy anchor can show that an event happened. They do not show that cash was received.

## What this replay can compare

The pilot totals named for this phase are not primary records in the repo:

| Claim | On file in this tree |
| --- | --- |
| 26/26 tests passing | No stored run. `agentz/tests` has 32 files and 216 `test_` functions. A passing test is not a mission |
| 5/5 mission cycles, 0 failures | No mission files |
| 0 unauthorized actions, 0 mission violations | No mission log to audit |
| 0 unverified claims emitted by the system | This audit is the check |
| $0.05 operating cost | No cost receipt |
| $499.95 net pilot value | No Value Receipt |
| Founder authorization exercised | No authorization record tied to a mission |

Search covered this repo, its other worktrees, workspace memory, and a HubSpot deal query for amounts from 499 to 501. There is no `$499.95` figure and no Value Receipt artifact.

HubSpot deal `318384843494`, [QRON White-Label - Fat Squirrel Creative](https://app.hubspot.com/contacts/245112265/record/0-3/318384843494?utm_source=app_30414272_mcp&utm_medium=ai_agent&utm_campaign=search), has `amount` 499, `dealstage` `appointmentscheduled`, and `hs_is_closed_won` false (last modified 2026-09-20). That is pipeline state. It is not closed-won, not `$499.95`, and not cash.

`agentz/core/blockchain.py` defaults the RPC to Polygon Amoy. No mission transaction hash is stored next to a receipt. An Amoy anchor would still be testnet evidence of an event, not mainnet settlement and not cash.

Two fresh livemode pulls on 2026-10-06, sealed in process with `sealStripeApiPayload` and classified by `classifyRevenue`, both returned `NO_QUALIFYING_REVENUE` (`qualifying` false). The pulls agree: 5 livemode charges, all founder emails (one paid $10, two unpaid $49, two unpaid $29), zero subscriptions, one livemode paid payout of $9.31. A payout does not qualify. The second pull was a second process with the same code and key, not a separate verifier. Fetched at 2026-10-06T23:29:15Z and 2026-10-06T23:32:57Z. Each read expires 24 hours after its own `fetched_at`. This is not a reason to book the pilot figure.

**Verified cash revenue:** `NO_QUALIFYING_REVENUE` on the two pulls above. Not established.

**Attributed or modelled value:** not verified. `$499.95` stays an external statement until a Value Receipt names its price source, quantity, and the external event it attributes. Do not divide it by `$0.05`.

**Missions in the comparison:** 0.

## Questions this replay is supposed to answer

What did AgentZ do differently when it succeeded? Not answerable. There is no persisted mission to diff.

What actually generated value? Not answerable. No receipt separates a catalogue price, a model, and cash.

What can safely become a repeatable business process? Nothing yet. Five unlogged successes would still be too small a sample. Zero logged missions means there is no candidate workflow to automate or scale.

## Evidence chain a mission must have

A mission enters the next replay only when every link is present:

1. Objective, as an observable predicate.
2. AgentZ decision, including the authority it used. `--mode auto` is not an available authority.
3. Authorized action. Send, charge, deploy, and mode auto stay founder-gated.
4. External state change, with an id outside the agent (Stripe object, signed customer artifact, or a named on-chain transaction). A HubSpot property write is a CRM event, not this link for cash.
5. Independent verification. Someone or some job other than the acting agent re-reads that external id.
6. Value Receipt. One of: `cash` (only if `classifyRevenue` would qualify it) or `attributed` (model inputs, not cash).
7. Economic measurement: cost, time to outcome, human escalations.
8. Lesson.
9. Next objective.

A missing link means the mission is not a verified outcome. It is not a failure of the business. It is an incomplete row, and it does not count toward the promotion rungs.

## Dashboard

Compute these from persisted missions only. Leave a cell blank when the inputs are missing. Do not backfill from the unnamed pilot totals.

| Measure | Now |
| --- | --- |
| Missions | 0 persisted |
| Verified outcomes | 0 |
| Verified cash revenue | `NO_QUALIFYING_REVENUE` at 2026-10-06T23:32:57Z |
| Attributed / modelled value | Not verified |
| Operating cost | Not verified |
| Net realized value (cash minus cost) | Blank |
| Cost per verified outcome | Blank (no verified outcome) |
| Opportunity → conversion rate | Blank |
| Time to outcome | Blank |
| Human escalations | Not logged |
| Recovery rate | Blank |
| Realized value / operating cost | Blank |

Realized value uses verified cash only. Attributed value is a separate column. The ratio is the number to watch once both the numerator and the denominator come from receipts. It is not a target to invent.

## Promotion

Authority stays where it is. Thresholds can change with risk. The rule does not: a passing test is not a promotion.

| Verified missions with the full chain | Rung |
| --- | --- |
| 1 | Demonstrated |
| 3 | Repeatable candidate |
| 10 | Scalable candidate |
| 25 or more | Consider autonomy expansion |

Current rung: none. Do not automate recurrence and do not raise AgentZ authority.

## Measurement that does not count

A revenue re-read was the only action available without a named inbox, a charge, or a mode change. It does not enter the mission table.

| Chain link | This re-read |
| --- | --- |
| Objective | Fresh `classifyRevenue` on livemode Stripe |
| AgentZ decision | Not an AgentZ action. Read-only. `--mode auto` stayed frozen |
| Authorized action | Founder-environment Stripe list of charges, subscriptions, and payouts |
| External state change | None. A list does not change Stripe, HubSpot, or a chain |
| Independent verification | Second process agreed. Same code, same key. Not a separate verifier |
| Value Receipt | `cash` rejected. `attributed` not created. No dollar value booked |
| Economic measurement | Operating cost not metered. Time not metered |
| Lesson | The classifier still finds no stranger paid activity. The unnamed $499.95 figure stays off the books |
| Next objective | Inbound OpenClaw `dpp` may answer with the public confirm page. `sell_existing_dpp` stays blocked on a named verified inbox. No mail is sent from that reply |

Counted verified missions remain 0. The promotion rung remains none.

## Next objective

Run one mission and persist the chain above. The Value Receipt must say `attributed` or `cash`, and `cash` only when Stripe evidence would pass `classifyRevenue`. Then this replay can compare mission 1 with the next one: what differed, what the receipt measured, and whether anything is safe to repeat.

Until that file exists, the autonomous economic engine is not in a repeatability record. It is an architecture with an empty audit.
