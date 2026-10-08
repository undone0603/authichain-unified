---
name: repo-integrator
description: >-
  Use when auditing or integrating undone0603/authichain-unified:
  estate drift, the network map, deploy workflows, or the phrase
  "audit the repo".
---

# Repo integrator

The agent is `repo_audit_integrate` in `agentz/workflows/registry.yaml`.

```bash
python -m agentz.cli run repo_audit_integrate --mode dry-run
python -m agentz.cli run repo_audit_integrate --mode auto
```

`dry-run` prints the audit and writes nothing. `auto` rewrites only the canonical banner in `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md`.

## Authority

- Code: this repository.
- Runtime: Cloudflare. `docs/ESTATE.md` and `docs/operations/CLOUDFLARE_FIRST_BASELINE.md` win over the July 2026 Vercel section in `docs/NETWORK.md`.
- Ledger: `config/cloudflare-estate.json`, checked by `node scripts/cloudflare/audit-estate.mjs`.
- Data: Drizzle into Supabase Postgres.

## Refused

Do not delete Workers, disable workflows, rotate tokens, npm-publish, merge the verify-package publish, transfer the GitHub org, or send email, charges, or posts. Those stay owner actions.
