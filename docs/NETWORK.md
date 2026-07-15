# AuthiChain Network Map

_As of 2026-07-15. One repo = the whole network. Update when deploy targets change._
_Consolidation spec: docs/superpowers/specs/2026-07-15-network-consolidation-design.md_

## Live apps

| What | Folder | Deploys via | Domain(s) |
|---|---|---|---|
| AuthiChain app | `client/` + `server/` + `src/` (root build, `next build`) | Vercel `authichain-unified-v2` (team authichain-6389) | app.authichain.com, authichain-unified-v2.vercel.app |
| QRON platform | `apps/qron-platform/` (source) | ⚠ Vercel `qron-platform` still builds from the old repo `undone0603/qron-platform` | qron.space, app.qron.space (hosts a registered Stripe webhook) |
| GovChain site | `apps/brand-sites/govchain/` + `workers/govchain-us/` | Vercel `govchain-us` / CF worker | govchain.us |
| StrainChain site | `apps/brand-sites/strainchain/` + `workers/strainchain-io/` | Vercel `strainchain-io` / CF worker | strainchain.io |
| Apex landing | `workers/authichain-com/` | CF worker (owns `authichain.com/*` + `www` route globs) | authichain.com |

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
- Vercel deploys: git integration on `main` (authichain-unified-v2) — plus manual `vercel deploy` from Windows CLI when needed.

## Follow-ups owed

- Re-point Vercel `qron-platform` to build from `apps/qron-platform/` (careful: live Stripe webhook host), then archive the old repo.
- Run `supabase/migrations/20260715000001_create_reputation_tables.sql` against live Supabase (owner action; needed before the reputation router returns data).
- Wire a real `/api/admin/ops` endpoint for `client/src/pages/OpsDashboard.tsx` (`/admin/ops` renders its error state until then).
- Owner: review + delete `/home/zac/_absorbed-*` folders; review `_absorbed-agentz_backup-HAS-KEY-FILES/{live_keys,backup_keys}.txt` and the excluded `_setenv_oauth.sh` (contains a live Google OAuth client secret — consider rotating it).
