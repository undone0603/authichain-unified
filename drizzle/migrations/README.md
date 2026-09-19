# Drizzle migrations (authoritative)

`drizzle.config.ts` writes here (`out: "./drizzle/migrations"`).
`pnpm db:migrate` / `drizzle-kit migrate` applies this folder.

`025_economy_align.sql` is **additive only** (`ADD COLUMN IF NOT EXISTS`,
and `CREATE TABLE IF NOT EXISTS` only for `automation_logs`). It does not
drop or recreate the QRON-v2 tables that already exist on project
`nhdnkzhtadfkkluiulhs`:

- `fee_flows` (gross/net/burn/treasury/staker split — already present)
- `brands` staking columns already on prod: `staking_tier`, `qron_staked`,
  `staking_locked_until`, `wallet_address`, `unit_cost_discount`, `base_unit_cost`
- `automation_logs`, `qrons`, `certifications`, `products`, `lead_captures`, `profiles`

Do not run `scripts/ops/activate-economy.js` as ad-hoc DDL. That script now
invokes this migrator.
