# AuthiChain production Drizzle baseline

## Current state

`drizzle/migrations` is the canonical migration source and `pnpm db:migrate` invokes `drizzle-kit migrate`.

The production audit is intentionally read-only. The live database has `drizzle.__drizzle_migrations`, but the table currently contains zero rows. The populated production schema therefore must **not** be treated as evidence that the numbered SQL migrations historically ran through Drizzle.

The repository currently contains the historical numbered SQL files plus the two newly promoted reconciliation migrations (`023_reputation_tables.sql` and `024_certificates_updated_at_reconcile.sql`). The canonical journal currently contains only `0000_tranquil_jackpot` and `0001_consolidate_qron_loyalty`, each with a corresponding snapshot.

## Why we do not seed the journal yet

Drizzle Kit's migration runner reads `meta/_journal.json` and the SQL files named by its entries. The database log stores a SHA-256 hash and a `created_at`/folder timestamp. A populated schema does not prove that any historical migration executed, and manually inserting rows with invented timestamps would create false provenance.

The production audit also identifies migrations that contain data-producing SQL. Structural equivalence cannot prove that those inserts/updates happened, so those effects require separate evidence before any historical migration is represented as applied.

`drizzle-kit` 0.31.x supports custom migrations without requiring a new snapshot for every custom SQL file. That does not make an absent historical journal entry safe to invent: each entry must correspond to a real migration artifact and a defensible ordering timestamp.

## Required baseline procedure

1. **Freeze the evidence.** Preserve the latest read-only production audit artifact and record its commit SHA and generation time.
2. **Complete schema reconciliation.** Require zero missing tables, zero missing columns, zero type differences, zero missing indexes, and zero index-definition differences for the migration set being baselined.
3. **Reconcile data effects separately.** For every migration flagged as data-producing, document independent evidence that its intended durable state is already present, or classify the effect as intentionally not part of the production baseline. Never infer this from table existence alone.
4. **Generate a fresh baseline from the verified production shape in an isolated workspace.** Use `drizzle-kit pull`/the existing-database workflow without mutating production while producing the baseline SQL and snapshot. The resulting baseline must be compared against `src/db/schema.ts` and the audit before it becomes canonical.
5. **Preserve historical SQL.** Do not rewrite or delete the old numbered SQL merely to make the journal look continuous. If the verified baseline supersedes legacy execution history, move the historical files to an explicitly non-executable archive outside the configured `out` directory, preserving their contents and provenance.
6. **Prepare the production tracking change separately.** The eventual production operation must create/initialize `drizzle.__drizzle_migrations` and record only the exact hash/timestamp for the verified baseline migration. It must be reviewed as a production migration action; this repository workflow does not perform it.
7. **Prove no-op behavior before changing production.** Against a disposable database initialized from the verified baseline, `pnpm db:migrate` must apply the baseline exactly once and then report no pending work on a second invocation. Fresh databases and the existing production database must converge to the same schema.
8. **Only after that proof, authorize the production baseline write.** The production action is outside the read-only audit and requires explicit authorization. It must be accompanied by a fresh audit immediately before and after the change.

## Safety invariants

- The audit workflow never mutates production.
- No migration is marked applied solely because its tables happen to exist.
- No historical timestamp is fabricated.
- Historical migration SQL remains preserved until the baseline is independently verified.
- `drizzle-kit migrate` remains the only forward schema migration mechanism.
- Direct SQL runners that apply schema migrations outside `drizzle/migrations` are retired.

## Drizzle references

- `drizzle-kit migrate` reads migration artifacts and records successful applications in `drizzle.__drizzle_migrations`.
- `drizzle-kit pull --init` is the documented existing-database initialization workflow, but `--init` mutates the migration tracking state and therefore is **not** used by the read-only production audit.

See the official Drizzle documentation for [`migrate`](https://orm.drizzle.team/docs/drizzle-kit-migrate) and [`pull`](https://orm.drizzle.team/docs/drizzle-kit-pull).
