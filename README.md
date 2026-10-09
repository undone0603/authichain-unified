# AuthiChain Unified

Production wrangler deploy is not optional. A docs-only commit on `main` still deploys.

`deploy-cloudflare.yml` and `deploy-edge-worker.yml` run on every push to `main`. They have no `paths` filter and no `paths-ignore`. Do not add one. `workflow_dispatch` is a manual rerun, not a substitute for the push trigger.

This file is the security README. It does not certify a product, a government document, or a cannabis COA.

## Absolute rules

These are fail-closed. A convenience exception is a defect.

1. Do not path-filter `deploy-cloudflare.yml` or `deploy-edge-worker.yml`. A README change on `main` redeploys the production Workers those workflows publish.
2. Do not put a credential in Git. No `CLOUDFLARE_API_TOKEN`, Stripe secret, webhook secret, database URL with a password, or private key. Placeholders only.
3. A secret that reached Git history is compromised until the provider confirms rotation. Deleting the file does not revoke it. This README does not rotate tokens.
4. Secret scan stays on. A failed gitleaks check blocks the merge. Do not skip it to ship docs.
5. The two deploy workflows stay enabled. This README does not disable workflows, delete Workers, npm-publish, merge #1481, or move the repo.
6. Resolution is not verification. A scan result is the checks this verifier ran. It is not a legal certificate, a government authentication, or a certificate of analysis.
7. `repo_audit_integrate` may refresh `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md` only. It does not authorize a delete. Its Action is `workflow_dispatch` and dry-run. Do not schedule it.
8. Customer paths are `https://authichain.com/onboard`, `https://authichain.com/dapp`, and `https://authichain.com/verify`. Never a `*.vercel.app` URL.

## What a deploy proves

A green production wrangler deploy proves the Worker bundle from that commit was published by the workflow. It does not prove the bundle is free of defects, that a seal is genuine, or that a third party audited it.

| Workflow | Trigger | Must stay |
|---|---|---|
| `deploy-cloudflare.yml` | every push to `main`, plus `workflow_dispatch` | no path filter |
| `deploy-edge-worker.yml` | every push to `main`, plus `workflow_dispatch` | no path filter |

`authichain-consensus-engine` is an identity collision. Confirm it in Cloudflare before any retirement. This README does not retire it.

## Trust boundary

AuthiChain turns a physical product or asset into a verifiable digital identity: an identifier resolves to a signed claim, policy and provenance data are evaluated, and an independent verifier returns an auditable result.

A positive status is scoped to the evidence and policy the verifier evaluated. A registered identifier does not prove manufacturing quality. A missing identifier is not proof of counterfeiting.

Surfaces on this trust model: AuthiChain, QRON, GovChain, StrainChain, AgentZ / MCP. The verticals do not fork the trust model.

## Public surfaces

- authichain.com — verification, API, billing
- qron.space — QRON
- govchain.us — government and contractor workflows
- strainchain.io — regulated-goods provenance workflows

Canonical customer paths: `/onboard`, `/dapp`, `/verify`.

## Map

| Layer | Location |
|---|---|
| Web | `client/`, `workers/` |
| Protocol | `protocol/` |
| AgentZ | `agentz/` |
| MCP | `mcp/` |
| Edge | `workers/*` |
| Data | Supabase Postgres, Drizzle. D1 is not a second product schema. |
| Topology | `docs/NETWORK.md`, `docs/ESTATE.md` |

Runtime authority is Cloudflare Workers. The July 2026 Vercel section in `docs/NETWORK.md` is historical. `scripts/guard-vercel-deploy.mjs` fails a workflow that adds a Vercel deploy step.

## Commands

```bash
cp .env.example .env
pnpm install
pnpm dev
```

```bash
python -m agentz.cli run repo_audit_integrate --mode dry-run
python -m agentz.cli run repo_audit_integrate --mode auto
```

`dry-run` prints and writes nothing. `auto` rewrites only the banner in `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md`.

## Report a vulnerability

Do not open a public issue. Use GitHub private vulnerability reporting. Policy: `docs/project/SECURITY.md`.

## License

See `docs/project/LICENSE.md`.
