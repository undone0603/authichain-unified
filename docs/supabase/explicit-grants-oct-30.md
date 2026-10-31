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
direct-connection only can opt out with `-- supabase-grants-exempt: public.<t> <reason>`. The reason is required and must be on the same line; an exemption without one fails the check.

## Custom roles (`authichain_app`)

QRON-v2 has a custom role, `authichain_app`. It has its own entry in the `postgres` role's default
privileges for `public` (tables and sequences), seen in a read-only `pg_default_acl` check on 2026-10-02.

**Not stated in docs.** As of 2026-10-02, the Supabase docs, discussion #45329 and the changelog do not
say what the Oct 30 rollout does to default privileges held by custom roles. Checked:
[discussion #45329](https://github.com/orgs/supabase/discussions/45329),
[changelog entry](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically),
[Securing your API](https://supabase.com/docs/guides/api/securing-your-api) (search_docs), and
[supabase/cli#5524](https://github.com/supabase/cli/pull/5524).

What _is_ documented: the opt-in SQL that Supabase publishes revokes default privileges only
`from anon, authenticated, service_role` (`alter default privileges for role postgres in schema public ...`),
and the FAQ says the change "touches default privileges in the `public` schema". `authichain_app` is
not a Data API role, so PostgREST access is not decided by it either way.

Inference (unverified, medium confidence): the `authichain_app` default grant is likely left in place.
Do not rely on it. A new table that `authichain_app` must reach should carry its own explicit
`grant ... to authichain_app` in the migration. Re-check `pg_default_acl` (read-only) after 2026-10-30.

## Not done here

No database was changed. This PR does not run the discussion's optional "opt in early"
`alter default privileges ... revoke` statements on any project; that would be a production change
and needs Zac's explicit yes.
