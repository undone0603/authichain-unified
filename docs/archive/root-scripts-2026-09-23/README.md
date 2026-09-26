# Root scripts archived 2026-09-23

These 38 one-off files sat at the repo root. They were moved here with `git mv`
(history preserved) as part of the autonomous-stack consolidation. Nothing was
deleted.

Why each was safe to move:

- **No live references.** No workflow, `package.json` script, Dockerfile or
  source file points at them. The only mentions were in the generated
  `.eslint-report.json` and in docs. `docs/superpowers/plans/2026-07-15-network-consolidation.md`
  had already listed most of them as archive candidates.
- **Newer copies exist.** Most of the `*.js` DB/seed/check helpers have
  maintained versions in `scripts/ops/`.
- **Placeholders only.** `all_used_envs.txt` and `clean_envs.txt` list env var
  names with placeholder values; neither contains a secret.
- **Deliberately left at the root.** `manual-migration.js`, `patch-schema.js`,
  `update-schema.js` (named in `scripts/check-drizzle-migrations.mjs`),
  `supabase-ca.crt`, `railway.json`, and every config file.

To restore one: `git mv docs/archive/root-scripts-2026-09-23/<file> .`
