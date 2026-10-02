# Supabase explicit GRANTs for new `public` tables (from 2026-10-30)

Owner: CF Deploy. Ticket: AE-20261002-CFD-62 (re ADM-16, PM-69).

## What changes

On **2026-10-30** Supabase applies its "don't expose new tables automatically" default to all
existing projects, including QRON-v2 (`nhdnkzhtadfkkluiulhs`). After that date a table created in
`public` gets **no** `select/insert/update/delete` for `anon`, `authenticated` or `service_role`, and
the Data API (PostgREST, `supabase-js`, `/rest/v1`) returns `42501 permission denied`.
Existing tables keep their current grants. Direct Postgres connections (Drizzle via `DATABASE_URL`)
are unaffected.

Sources: [supabase discussion #45329](https://github.com/orgs/supabase/discussions/45329),
[Securing your API](https://supabase.com/docs/guides/api/securing-your-api),
[Creating API routes](https://supabase.com/docs/guides/api/creating-routes).

## The rule

Every migration that creates a `public` table ships, in the same file:

1. `alter table public.<t> enable row level security;`
2. explicit grants, least privilege;
3. policies for any client role (`anon` / `authenticated`) it grants.

Supabase's documented grant block (adjust per table; never wider than this):

```sql
grant select on public.your_table to anon;
grant select, insert, update, delete on public.your_table to authenticated;
grant select, insert, update, delete on public.your_table to service_role;
```

Most tables in this repo are **server-only** (RLS on, no policies, written with
`SUPABASE_SERVICE_ROLE_KEY`), so the usual block is just:

```sql
grant select, insert, update, delete on table public.your_table to service_role;
```

Note: `revoke all ... from anon, authenticated` on its own (the pattern in
`20260930152032_attestation_trust_registry_and_status.sql`) relied on the auto-grant for
`service_role`. After Oct 30 a new table written that way has no `service_role` access either,
so add the explicit `service_role` grant.

Serial/bigserial columns also need `grant usage, select on sequence ...` for roles that insert;
identity columns do not.

Copy-ready template: [`supabase/migration-templates/new-public-table.sql`](../../supabase/migration-templates/new-public-table.sql).

## CI check

`node scripts/ci/check-supabase-grants.mjs --run` (CI workflow `CI`, job "Schema and AgentZ checks")
fails when a migration in `supabase/migrations/` or `drizzle/migrations/` that is not in
`scripts/ci/supabase-grants-baseline.txt` creates a `public` table without a grant to
`anon`/`authenticated`/`service_role`, or grants a client role without enabling RLS.
Tests: `node --test scripts/ci/check-supabase-grants.test.mjs` (run by the Lint workflow).

The baseline lists the migrations that existed on 2026-10-02; all of their tables already exist on
QRON-v2 and keep their grants. Never add a new migration to the baseline. A table that is genuinely
direct-connection only can opt out with `-- supabase-grants-exempt: public.<t> <reason>`.

## Not done here

No database was changed. This PR does not run the discussion's optional "opt in early"
`alter default privileges ... revoke` statements on any project; that would be a production change
and needs Zac's explicit yes.
