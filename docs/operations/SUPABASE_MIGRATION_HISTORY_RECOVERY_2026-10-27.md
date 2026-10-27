# QRON-v2 migration history recovery — 2026-10-27 (read-only evidence)

**Scope:** `nhdnkzhtadfkkluiulhs`, compared with GitHub `main` at `a95b7b0432ec3173badc0805bf889615c4f50284` (2026-10-27). This is a non-production, owner-review-only recovery note. **Do not apply, replay, repair, or mark migrations applied from this document.** No production DDL or migration-history edits were performed.

## Confirmed version drift

The Supabase migration history contained **70 applied versions**; `supabase/migrations/` contained **69 local SQL files** at the observed main SHA. The following applied versions have no matching local filename:

| Applied version | Remote name | Stored SQL characters | MD5 of joined statements (inventory only) |
| --- | --- | ---: | --- |
| `20261014195307` | `ai_adapt_archive_v2_write_functions` | 3966 | `38c22531a3d11a3a5867e5d03a647e36` |
| `20261014195334` | `ai_adapt_archive_v2_submit_swh_retry_dead_hosts` | 4263 | `9d1c42322a182da75fb3791a0f0c02da` |
| `20261014195349` | `ai_adapt_heartbeat` | 3330 | `05938a6091b22bc0730775ae8e8c2dfb` |
| `20261015061249` | `govchain_public_views_restore_definer_semantics` | 1257 | `fba3452ec1e3d719f8de29150162e52b` |
| `20261016213335` | `x402_claim_free_call` | 1846 | `33a06265b584cf5a6dbd3a945d675936` |

Local-only filenames at the observed main SHA were `20261014120000_attestation_revocation_terminal.sql`, `20261014200000_govchain_public_views_invoker_grants.sql`, `20261016200000_x402_claim_free_call.sql`, and `20261022190000_recover_verify_family_functions.sql`. **This branch only corrects the x402 filename**: the remote SQL for `20261016213335` was read from `supabase_migrations.schema_migrations.statements` and compared character-for-character with local `20261016200000_x402_claim_free_call.sql`; they were **identical (1846 characters)**. The SQL body is unchanged. This reduces the remote-only mismatch by one and removes one local-only version; it does not establish overall parity or CI success.

## Critical review holds

- **Do not blindly replay `20261014195349`**: its stored SQL creates a SECURITY DEFINER heartbeat function, accesses vault secrets, can call `net.http_post` to an email provider, and schedules a `pg_cron` job. Restoring it as an executable migration may trigger outbound email in preview or other environments. Separate function definition, permissions, scheduling and delivery approval before any recovery.
- **Do not blindly replay `20261015061249`**: its stored SQL explicitly sets two GovChain public views to `security_invoker=false`. The current repository also has an invoker-mode grants migration (`20261014200000`); these represent conflicting security designs. Compare current live catalog, RLS, grants, advisor errors and user-facing behavior before selecting a final state.
- The two other AI Adapt functions are also privileged database changes; review bodies and rollback semantics before restoring files. This inventory contains hashes only, not the executable SQL bodies or secrets.
- The remaining local-only files may be legitimate pending changes. Never mark them applied merely to silence CI. Production migration history is authoritative evidence, not permission to mutate it.

## Safe retrieval / next checks

Use a **read-only** SQL query against the named project, in a secure owner-controlled environment, to inspect the exact stored statements and rollbacks:

```sql
SELECT version, name, statements, rollback
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20261014195307', '20261014195334', '20261014195349',
  '20261015061249', '20261016213335'
)
ORDER BY version;
```

1. Recover each exact original body with provenance; review security and outbound side effects before proposing executable migrations.
2. Compare catalog definitions and migration order against a disposable, explicitly authorized non-production environment; never use production DDL or `migration repair` to paper over drift.
3. Re-run Supabase Preview on the exact draft head, inspect the failure logs, and require all release checks including Hardhat plus owner approval before any merge or deployment.

Related: [CI blocker #1871](https://github.com/undone0603/authichain-unified/issues/1871), [revenue issue #1986](https://github.com/undone0603/authichain-unified/issues/1986).
