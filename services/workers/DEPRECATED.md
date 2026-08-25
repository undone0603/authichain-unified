# services/workers/ — DEPRECATED DUPLICATE

This directory is a **verbatim copy** of the top-level `workers/` tree. It is:

- **Not deployed** by any CI workflow (all deploys use `workers/`)
- **Not in the pnpm workspace** (`pnpm-workspace.yaml` includes `services/*`, not `services/workers/*`)
- **Excluded from typecheck** (`tsconfig.json` line 61: `"services/workers/**/*"`)
- **Not imported** by any source file

It exists only as a stale duplicate that will drift from the canonical `workers/` tree.
**Do not edit files here** — edit `workers/<name>/` instead.

This directory should be removed. It was left in place only because the
tooling available during the review could not delete non-empty directories
in bulk. Safe to `rm -rf services/workers/` once confirmed.
