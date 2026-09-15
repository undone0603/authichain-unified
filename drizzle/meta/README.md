# Deprecated Drizzle metadata

This directory is intentionally non-authoritative.

All schema migrations and Drizzle migration metadata live under `drizzle/migrations/`, which is the directory configured by `drizzle.config.ts` and used by `pnpm db:migrate` / `drizzle-kit migrate`.

Do not add migration snapshots or journals here. New schema changes must be numbered migrations in `drizzle/migrations/`.
