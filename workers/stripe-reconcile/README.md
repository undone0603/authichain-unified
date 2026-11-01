# stripe-reconcile (P0-4)

Daily Stripe ↔ Supabase reconciliation Worker. **Not deployed.** Deploy, cron enable, and migration (#2027) need Zac's approval.

## Vars
| Var | Default | Meaning |
|---|---|---|
| `DRY_RUN` | `"true"` | Compute and log the summary; write nothing. `"false"` writes exactly one `reconciliation_runs` row. |
| `FULL_HISTORY` | `"false"` | `"true"` forces a full-history scan. Otherwise the run looks back 48h, except Sundays (UTC), which scan full history. |

**First live run (condition 3):** `DRY_RUN=true` with `FULL_HISTORY=true` (or a Sunday run). Expected: the Sep 20 $10 Zac test is allowlisted → `excluded_test_count=1`, customer revenue $0, nothing written.

## Secrets (names only, set by Zac)
`STRIPE_RECON_RESTRICTED_KEY` (restricted, read-only), `SUPABASE_ANON_KEY`, `RECON_DB_JWT` (role `stripe_reconciler`; service_role is refused).

## Allowlist
`ops/reconcile/excluded-test-payments.json` — PENDING ZAC CONFIRMATION.

## Tests
`npx vitest run` (Node 22).
