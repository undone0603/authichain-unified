# AuthiChain Unified

**The canonical implementation of AuthiChain's physical-world trust layer.**

This README is the security contract for the repository. A docs-only change does not skip production deploy.

## Absolute security

Absolute security here means the controls below are fail-closed and must not be weakened. It is not a SOC 2, FedRAMP, FDA, EUDAMED, or cannabis COA certificate. A scan is not a legal certificate, a manufacturing inspection, or proof that a government record is authentic.

### Production deploy stays on

`deploy-cloudflare.yml` and `deploy-edge-worker.yml` run on every push to `main`, including a commit that only changes this README. Do not add `paths` or `paths-ignore` to either workflow. Do not disable them. `workflow_dispatch` is a manual rerun, not a replacement for the push trigger.

Those workflows publish:

| Workflow | Worker | Config |
|---|---|---|
| `deploy-cloudflare.yml` | `authichain-edge-router` | `worker-app/wrangler.toml` |
| `deploy-cloudflare.yml` | `authichain-scan-validate` | `workers/authichain-scan-validate/wrangler.toml` |
| `deploy-edge-worker.yml` | `authichain-revenue-worker` | `api/wrangler.toml` |

A README commit still runs both. That is intentional.

### Fail closed before Wrangler

Each of those workflows secret-scans the tree with gitleaks before deploy. Deploy `needs` the scan. A scan failure must not publish. Do not remove the scan, do not mark it `continue-on-error`, and do not swap it for a check that skips on rate limits.

Permissions on both workflows stay `contents: read`. Do not grant `contents: write`, `id-token`, or secret-admin scopes to make a docs commit "faster."

Deploy uses `wrangler deploy --minify --keep-vars`. `--keep-vars` is required so a redeploy does not wipe existing Worker vars. Do not drop it.

### Secrets

- No credentials in Git, this README, issues, or logs.
- Runtime secrets live in GitHub encrypted secrets and Wrangler secrets. Names only: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- Never print, request, or hardcode a secret value. Placeholders only: `sk_live_…`, `whsec_…`, `postgresql://USER:PASSWORD@HOST/DB`.
- Removing a secret from HEAD does not un-leak it. Treat a committed credential as compromised until the provider confirms rotation.
- This README does not rotate tokens. Rotation is an owner action.

### What this agent must not do

`repo_audit_integrate` may refresh `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md`. It must not delete Workers, disable workflows, rotate tokens, npm-publish, merge the verify-package publish, move the repo to an organization, or send email, charges, or posts.

Do not retire `authichain-consensus-engine` from an audit note. The ledger marks an identity collision. Confirm it in the Cloudflare dashboard before any retirement.

### Trust boundary

Resolution is not verification. A registered identifier does not prove manufacturing quality. A missing identifier is not by itself proof of counterfeiting. Customer paths stay on the apex domains (`https://authichain.com/verify`, `https://qron.space/generate`, `https://govchain.us/onboard`, `https://strainchain.io/onboard`), never a `*.vercel.app` host.

## What this repository is

AuthiChain turns a physical product or asset into a verifiable digital identity: a standards-aware identifier resolves to a signed claim, policy and provenance data are evaluated, and an independent verifier returns an auditable result.

- **AuthiChain** — verification, attestations, product identity, API and billing
- **QRON** — programmable verification experiences and QR studio
- **GovChain** — government and contractor trust workflows
- **StrainChain** — provenance for regulated physical goods
- **AgentZ / MCP** — agentic orchestration over the same trust primitives

One verification protocol. Vertical products must not fork the trust model.

## Repository map

| Layer | Location | Responsibility |
|---|---|---|
| Web / customer surfaces | `client/`, `workers/` | Public domains |
| Verification protocol | `protocol/` | Reference implementation |
| Agentic operations | `agentz/` | Workflow orchestration |
| Machine interface | `mcp/` | MCP access |
| Edge / API | `workers/*`, `worker-app/`, `api/` | Cloudflare Workers |
| Persistence | Supabase/Postgres + D1 | Operational state. D1 is not a second product schema. |
| Estate | `docs/ESTATE.md`, `docs/NETWORK.md`, `config/cloudflare-estate.json` | Inventory. July 2026 Vercel section in `docs/NETWORK.md` is historical. |

## Public surfaces

- `authichain.com` — protocol, verify, certificates, billing
- `qron.space` — generate
- `govchain.us` — contractor pursue and seals
- `strainchain.io` — cannabis jar pack

Canonical paths: `/verify`, `/dapp`, `/onboard`.

## Deployment model

Cloudflare-first. Vercel is not a deploy. `scripts/guard-vercel-deploy.mjs` fails a workflow that adds a Vercel deploy step.

- Edge: Cloudflare Workers + Wrangler 4
- Web: Vite + React
- Data: Drizzle into Supabase Postgres
- Package manager: pnpm
- Agent runtime: `python -m agentz.cli`

```bash
python -m agentz.cli run repo_audit_integrate --mode dry-run
python -m agentz.cli run repo_audit_integrate --mode auto
```

`dry-run` prints and writes nothing. `auto` rewrites only the banner in `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md`. The GitHub Action **Repo audit integrate** is `workflow_dispatch` and dry-run only. It is not on a schedule.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Never put credentials in source. Set `DATABASE_URL` in the local environment or the deployment secret store.

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
```

## Pilot readiness

`install → typecheck → lint → tests → production build → deploy smoke test → real product scan`

See `docs/operations/PILOT-READY-BASELINE.md`, `docs/attestation/v0.1.md`, `docs/ESTATE.md`, and `docs/NETWORK.md`.

## License

See `docs/project/LICENSE.md`.
