# Autonomous economy status

Evidence read on 2026-10-13 after merge commit `d144c2154ceb197ce1e12a2f30f1a73dfb268465`. This is not a claim that the autonomous economy is complete. A green build, a merged pull request, a deploy, or one historical charge is not an active buyer.

The founder's $10 charge is not qualifying revenue. `classifyRevenue` does not count a founder charge. It was not backfilled into a 50-generation entitlement.

## Claims

| Claim                          | State                         | What the evidence supports                                                                                                                      |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment provider evidence      | BLOCKED                       | The stored livemode restricted key returns HTTP 401. No fresh livemode charge list was read. Test-mode charges are not production payments.     |
| Webhook signature verification | VERIFIED                      | Invalid signatures are rejected. One `checkout.session.completed` for the demo session was stored `success` / HTTP 200 at 2026-10-13 18:25:36Z. |
| Successful fulfillment         | IMPLEMENTED_NOT_LIVE_VERIFIED | A $0 `is_demo` checkout was fulfilled on 2026-10-13. No non-founder $299 checkout has been fulfilled.                                           |
| Entitlement persistence        | VERIFIED                      | One demo profile stores `generations_limit` 50 and session prefix `cs_live_a1YwNmpf7ODzyhHayglo` exactly once. It is not a paying customer.     |
| Customer activation            | BLOCKED                       | That demo session has no `dpp_loop:merchant_activated` row. A demo grant is not an activated customer.                                          |
| Agent identity verification    | IMPLEMENTED_NOT_LIVE_VERIFIED | PR 1829 verifies `authichain-agent/1` in tests. The branch is not merged and not deployed.                                                      |
| Outbound authorization         | IMPLEMENTED_NOT_LIVE_VERIFIED | The gate on PR 1829 allows a test-transport capture only. `production_send` stays false.                                                        |
| Actual message delivery        | NOT_IMPLEMENTED               | No production sender is configured. A test-transport capture is not a delivered message. No mail has been sent.                                 |
| Inbound response handling      | IMPLEMENTED_NOT_LIVE_VERIFIED | The dogfood path records a fixture `INTERESTED` reply in memory. No live inbound reply exists.                                                  |
| Customer acquisition           | BLOCKED                       | No named eligible inbox is authorized, and no non-founder $299 purchase is on record.                                                           |
| Retention                      | IMPLEMENTED_NOT_LIVE_VERIFIED | The retention cron exists. The only `dpp_loop:retained` row is a demo. No paying customer has been retained.                                    |

## Payment and entitlement

Merge: PR 1830, merged 2026-10-13T16:43:52Z. Merge commit `d144c2154ceb197ce1e12a2f30f1a73dfb268465`. Feature commit `2bd1b624260159abaefe98d4013c4135b081c1d7`. Required check `Main quality gate` passed before merge. Reviews were empty. Branch protection was not bypassed.

The fix on `main`:

- `src/lib/provisioning.ts` does not write `subscribed_at`. Live `public.profiles` has no such column.
- `src/lib/dpp-fulfill-checkout.ts` throws when `provisionPurchase` returns `upsert_failed`, before `dpp_loop:provisioned`.
- The same Stripe session still returns early and does not reset `generations_used`.
- A DPP grant uses `PLAN_CREDITS.dpp_readiness`, which is 50.

Deploy: GitHub Actions `Deploy to Cloudflare` run [38432899878](https://github.com/undone0603/authichain-unified/actions/runs/38432899878), event `push`, head `d144c2154ceb197ce1e12a2f30f1a73dfb268465`, conclusion success. Worker `authichain-edge-router` was uploaded twice. The live version after the attestation-key upload is `5ec1c21d-d54e-4a37-9918-58df645a2277`. The earlier upload in the same run was `846ccf4a-b7e8-42ec-a752-5dee5a9d5f7c`. Version `5a7f3a93-bf7c-4ff8-b7e8-abf82300a02c` belongs to `authichain-scan-validate`, not the edge router.

Post-deploy smoke in that run: 10/10 passed, including unsigned `POST https://authichain.com/api/stripe/webhook` → 400. A later local dummy `stripe-signature` probe also returned HTTP 400 and reported `STRIPE_WEBHOOK_SECRET=set` and `STRIPE_WEBHOOK_AUTHICHAIN_SECRET=set`. Secret values were not printed or changed. Deploy success is not payment fulfillment.

Webhook endpoint `we_1UGTCSGqTruSqV8ThM9bXVWp` was reported `in sync` by `Stripe webhook reconcile` run [38433709051](https://github.com/undone0603/authichain-unified/actions/runs/38433709051). That is endpoint configuration, not a fulfilled checkout. `CI Main` run [38432899727](https://github.com/undone0603/authichain-unified/actions/runs/38432899727), `Lint` run [38432899420](https://github.com/undone0603/authichain-unified/actions/runs/38432899420), and `Security Scan` run [38432899752](https://github.com/undone0603/authichain-unified/actions/runs/38432899752) succeeded on the merge commit.

`GET https://authichain.com/checkout/dpp_readiness` returns 200 and shows $299. The response does not contain `buy.stripe.com`. No card was charged for this check. No old event was replayed.

### Demo grant, not a buyer

Read at 2026-10-13 after 18:25Z. One profile on domain `authichain.com`, with a test/demo/smoke local-part, has `generations_limit` 50, `generations_used` 0, `subscription_plan` `dpp_readiness`, `subscription_status` `active`, `tier` `free`, and no `stripe_customer_id`. `last_grant_session_id` prefix `cs_live_a1YwNmpf7ODzyhHayglo` appears on exactly one profile. `stripe_events` has one matching `checkout.session.completed` row, `status=success`, `http_status=200`, `processed_at` 2026-10-13 18:25:36Z. The funnel recorded `dpp_loop:payment_succeeded` with `amount_total` 0 and `is_demo=true`, then `dpp_loop:provisioned` with `is_demo=true`. There is no `merchant_activated` row for that session. This shows the deployed grant path can persist a demo. It is not a $299 purchase and not qualifying revenue.

### Application database

Supabase project `nhdnkzhtadfkkluiulhs`, read after the deploy.

`public.profiles` columns used by the grant include `generations_limit`, `generations_used`, `last_grant_session_id`, `subscription_status`, `subscription_plan`, and `last_payment_at`. There is no `subscribed_at` column.

| Measure                     | Count |
| --------------------------- | ----- |
| profiles                    | 4     |
| `last_grant_session_id` set | 1     |
| `generations_limit = 50`    | 1     |
| `last_payment_at` set       | 1     |
| `stripe_customer_id` set    | 0     |
| `entitlements`              | 0     |
| `checkout_sessions`         | 0     |

The single grant is the $0 demo above. The other profiles have `generations_limit` 0.

`public.stripe_events`:

| Event                        | Status  | HTTP | Rows | Latest               |
| ---------------------------- | ------- | ---- | ---- | -------------------- |
| `checkout.session.expired`   | success | 200  | 129  | 2026-10-11 18:33:37Z |
| `checkout.session.expired`   | error   | 400  | 75   | 2026-09-23 03:17:34Z |
| `checkout.session.completed` | success | 200  | 1    | 2026-10-13 18:25:36Z |
| `checkout.session.completed` | empty   | null | 4    | 2026-09-20 21:26:04Z |

The 2026-10-13 completed row is the $0 demo session. The expired successes show signature verification accepted those deliveries. A dummy signature returning 400 shows rejection, not fulfillment.

`funnel_events` still holds five `dpp_loop:payment_succeeded` rows. Four have `amount_total` 0. The only positive amount is 1000 cents, plan `dpp_readiness`, founder payer, session prefix `cs_live_a1uJEBIoeOSPY1`, on 2026-09-20. A `dpp_loop:provisioned` row was written for that session. The profile grant was not. That is the defect PR 1830 fixes for the next delivery. The old event was not replayed and the profile was not edited. Demo and zero-amount rows, including DPP-SMOKE-E2E, are not customers. The single `dpp_loop:retained` row is `is_demo=true`.

### Provider access

Stripe CLI 1.40.6 has a config for account `acct_1SXIyEGqTruSqV8T`. The stored livemode restricted key is rejected with HTTP 401 `Invalid API Key`. The test-mode key can list charges. Those three charges are `livemode=false` (one $1.00 with no email, two $2,500.00 founder) and are not production revenue. The Stripe MCP connector is not authenticated. The exact step that unblocks a livemode charge list is `stripe login`, or replacement of the revoked livemode restricted key. Do not invent a key.

These remain different claims. A configured webhook secret, a valid signature, and a delivered demo webhook are verified. A fulfilled $299 checkout, a paying customer's entitlement, and an activated customer are not.

PR 1831 (`81d0a70c`) merged with an empty tree identical to `d144c215` and was redeployed. `humanHold` is still set for the $299 price on `workers/stripe-webhook`. Open PR 1832 would clear that hold and can stamp `generations_limit` before the edge router. It was not merged. PR 1834 is on `main` as `a017ed5e` and publishes one signed AgentZ presentation. PR 1829 now conflicts with that change. PR 1835 makes a failed lead insert return 500. Its `Main quality gate` passed. It was not merged.

## Tests

Local, on checkout `d144c215`, after `pnpm install --frozen-lockfile` in a clean worktree:

- `pnpm exec vitest run src/lib/dpp-fulfill-checkout.test.ts src/lib/provisioning.test.ts src/app/api/stripe/webhook/route.test.ts server/webhooks/stripe.test.ts` — 4 files, 70 passed.
- `pnpm test:contracts` (`hardhat test`) — 6 passing. `@nomicfoundation/hardhat-node-test-runner` 3.1.0 is declared in `package.json` and present in `pnpm-lock.yaml`. The earlier local failure was an incomplete `node_modules`, not a missing declaration. No lockfile change. No Solidity change.

PR 1829 tests, commit `6a8448a4a0729fc812a05b3a6077372f3775c545`, not on `main`:

- `agent-verifier.test.ts` — 15 passed.
- `outbound-pipeline.test.ts` — 17 passed, including the AgentZ dogfood path. The capture is `external: false`, `production_send` is false, and `entitlements_granted` is 0.

## Agents and outbound

PR 1829 stays open, mergeable, and clean. `Main quality gate` is green. It is not merged and its branch is not deployed. `production_send` remains false. No external message was sent. No eligible named inbox was approved in this session, so none was invented.

The dogfood sequence on that branch runs in memory through prospect discovery, qualification, agent assignment, an `ALLOW` decision, a signed test-transport capture, a fixture inbound `INTERESTED`, a catalogue checkout URL, and `ENTITLEMENT_NOT_GRANTED`. It does not open Stripe and does not grant generations.

## D1

Do not rerun `.github/workflows/d1-license-migrate.yml` with the current GitHub Actions token. Run 38425011850 failed with Cloudflare error 7403: the token can publish Workers and cannot query D1. The minimum change is D1 edit on account `4c1869b90f13f86940aa3747839bf420` for database `authichain-license-db` (`7757b9f2-d25f-4561-866b-37392d5cb660`). The license tables and `idx_licenses_one_active_customer` are already present. This session did not change that token and did not rerun the workflow.

`schema/agent-outbound.sql` was not applied. `workers/authichain-verify-worker/wrangler.toml` has no D1 binding, and a previous inventory found no `agent` or `outbound` tables on shared D1 `authichain-db`. Absence of a binding is not a reason to add one in this payment fix.

## Next measurable milestone

A person who is not a founder opens:

`https://authichain.com/checkout/dpp_readiness?utm_source=authichain&utm_medium=sales_api&utm_campaign=battery-passport&utm_content=dpp_readiness`

They enter a real work email and pay the $299 EU DPP Workspace. After that payment, the acceptance read is: a signature-verified `checkout.session.completed`, `payment_status=paid`, amount 29900 USD, one `profiles.last_grant_session_id` equal to that session, `generations_limit` 50, `dpp_loop:provisioned` only after that write, and activation at `https://authichain.govchain.us/dpp/activate` with that `session_id`. Until that read exists, production payment-to-entitlement is unverified.
