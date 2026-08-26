-- Give missions.status and payments.status the defaults src/db/schema.ts
-- already promises they have.
--
-- Drizzle's `.default(...)` does not send the value. It emits the SQL keyword
-- DEFAULT and lets the database supply one. Where the database has no default,
-- DEFAULT resolves to NULL — and both of these columns are NOT NULL, so an
-- insert that omits the column raises:
--
--   [23502] null value in column "status" violates not-null constraint
--
-- This is the same defect that made mission_tasks unwritable for months across
-- all 23 call sites that enqueue an agent task. Every current insert into these
-- two tables passes status explicitly, so nothing is failing today; this closes
-- the trap before the next call site that reasonably trusts the declared
-- default falls into it.
--
-- Found by scripts/check-schema-drift.mjs, which now compares nullability and
-- defaults rather than column names alone.
--
-- Both statements only ADD a default. Nothing is tightened and nothing is
-- dropped, so this cannot reject a row the database accepts today. Validated
-- against the live database inside a transaction that was rolled back: with the
-- default in place, `insert into missions (id, type, title, description)` —
-- which previously raised 23502 — stored status 'pending'.

alter table missions alter column status set default 'pending';
alter table payments alter column status set default 'pending';
