# AuthiChain Network Map

_As of 2026-07-15. One repo = the whole network. Update when deploy targets change._
_Consolidation spec: docs/superpowers/specs/2026-07-15-network-consolidation-design.md_

## Live apps

_Verified against the Vercel API 2026-07-15. All six team projects are linked to THIS repo (undone0603/authichain-unified); the old undone0603/qron-platform repo deploys nothing._

| What | Folder | Deploys via | Domain(s) |
|---|---|---|---|
| **The network app** (one Next.js app serves every brand) | repo root (`src/` + `client/` + `server/`, `next build`) | Vercel **`qron-platform`** (prj_GD9ypyGrjibx4Ab88M52xufUf1ph, repo root, linked 2026-06-19) | qron.space, app.qron.space, authichain.com, app.authichain.com, govchain.us, strainchain.io (+ www variants). Hosts the registered Stripe webhooks and the `/api/cron/nurture-replies` cron. |
| Brand-pitch microsites | repo root (same build, multi-tenant) | Vercel `authichain-unified` | ~50 `<pitch>.authichain.com` subdomains (diageo, lvmh, pfizer, …) |
| Edge worker | `worker/` | Vercel `authichain-unified` (rootDirectory `worker`) | none attached |
| Spares (linked, no domains) | — | Vercel `govchain-us`, `strainchain-io`, `authichain-portfolio` | none — candidates for deletion |
| Apex landing / SEO layer | `workers/authichain-com/`, `workers/{govchain-us,strainchain-io,qron-space}/` | CF workers (route globs, where DNS is proxied through Cloudflare) | fronting authichain.com/* et al. |

## Cloudflare workers

- **Repo-managed** (`workers/<name>/`): deployed by `.github/workflows/deploy-cloudflare.yml` on push; each worker's `wrangler.toml` is the source of truth for routes and crons (in-repo toml is the durable place to kill a cron).
- **Deliberate keeps outside the repo** (no source here): `gmail-relay-z`, `qron-self-heal`, `qron-daily-ops`, `qron-ai-api`, `qron-portfolio`. (Estate consolidated 68→27 workers, June 2026.)
- **Archived bundles of deleted workers**: `docs/archive/cf-workers/` (34 bundles, secrets redacted — the embedded Stripe/Groq keys were verified dead 2026-06-11).
- D1 `authichain-provenance` = `5a6672a7-b3cb-43d4-85d4-d675451e58cb` (recreated 2026-07-14).

## Other network members

| What | Folder | Notes |
|---|---|---|
| AgentZ (python ops agent) | `agentz/` | `python -m agentz.cli run <id>`; ALL outbound gated; venv at `~/.agentz-venv` |
| Agent-browser | `apps/agent-browser/` | git history remains at `undone0603/agent-browser` |
| Chatbot | `apps/chatbot/` | previously un-versioned; repo copy is canonical |
| Brand site sources | `apps/brand-sites/{authichain,govchain,strainchain}/` | static `public/` snapshots from `/home/zac/<Brand>/` |
| Contracts | `contracts/` | AuthiChainNFT.sol + test infra |
| Ops scripts | `scripts/ops/` (+ `scripts/ops/home/` June-2026 session archive) | one-shot helpers, unmaintained |
| Strategy docs | `docs/strategy/` | proposals, checklists, briefs, grant applications |
| DB | Supabase `nhdnkzhtadfkkluiulhs` (Postgres, pooler `aws-1-us-east-2`, port 5432/6543) | real + populated; additive migrations only |

## Build & deploy mechanics

- Build/typecheck INSIDE WSL Ubuntu (node 22 via nvm; strip `/mnt/c` from PATH). See `docs/superpowers/specs/` and memory notes; helper pattern archived at `scripts/ops/home/`.
- `apps/*` trees are deliberately inert: excluded from root `tsconfig.json` and not in any pnpm workspace. Wire them into the root build only when something real needs it.
- Vercel deploys: git integration on `main` (authichain-unified) — plus manual `vercel deploy` from Windows CLI when needed.

## Follow-ups owed

- ~~Re-point Vercel `qron-platform` to the monorepo~~ — MOOT: it already builds this repo's root (since 2026-06-19) and serves ALL principal domains. `apps/qron-platform/` is the archival source of the old standalone app; do NOT set it as rootDirectory (that would replace the live network app). The old undone0603/qron-platform GitHub repo can be archived.
- ~~Reputation migration~~ — DONE 2026-07-15 (owner-approved): `user_reputation` + `reputation_events` created on live; `scheduled_job_runs` already existed. Runner: `scripts/ops/apply-reputation-migration.cjs`.
- ~~`/api/admin/ops`~~ — DONE 2026-07-15: admin-gated endpoint aggregating `scheduled_job_runs`; `/admin/ops` is live.
- Vercel spares `govchain-us`, `strainchain-io`, `authichain-portfolio` have no domains — confirm and delete to free slots (owner call).
- Owner: review + delete `/home/zac/_absorbed-*` folders; review `_absorbed-agentz_backup-HAS-KEY-FILES/{live_keys,backup_keys}.txt` and the excluded `_setenv_oauth.sh` (contains a live Google OAuth client secret — consider rotating it).
