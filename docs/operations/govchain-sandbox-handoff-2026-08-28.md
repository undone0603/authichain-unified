# GovChain sandbox review — 2026-08-28

Reviewed Grok sandbox artifacts against `undone0603/authichain-unified` main.
**Do not overwrite live GovChain files with the sandbox copies.**

## Verdict

| Sandbox file | Repo state | Action |
|---|---|---|
| `government-lead-gen-v2.ts` (v2.3, Pinecone, fictional `@authichain/core`) | Live `src/agents/government-lead-gen-v2.ts` is **v2.5**: real SAM + awards + USAspending, Supabase pgvector, `DRY_RUN` default true, `sendEmail`, QRON worker | **Keep repo. Discard sandbox.** |
| `govchain-engine.yml` (single job, `npm run start:gov-engine`, `npm ci`) | Live `.github/workflows/gov-engine.yml` is a 5-phase reusable pipeline: preflight → ingest → score → proposals → mint → notify. Repo uses pnpm, not npm. | **Keep repo. Discard sandbox.** |
| `run-gov-engine.sh` / `monitor-engine.sh` | Placeholders (`cd /path/to/your/repo`, `/var/log/...`). Repo already has `server/scripts/run_gov_engine.ts` | Replaced by `scripts/ops/run-gov-engine.sh` and `scripts/ops/monitor-gov-engine.sh` |

## What is already live in the repo (keep)

- `src/agents/government-lead-gen-v2.ts` (v2.5)
- `server/scripts/run_gov_engine.ts`
- `src/app/api/cron/govchain/route.ts`
- `supabase/migrations/00008_gov_opportunities_pgvector.sql`
- Workflows: `gov-engine.yml`, `gov-ingest.yml`, `gov-score.yml`, `gov-proposals.yml`, `gov-mint.yml`, `gov-notify.yml`
- Supporting scripts: `scripts/ingest-sam.ts`, `scripts/score-opportunities.ts`, `scripts/generate-proposals.ts`, `scripts/mint-govchain-nfts.ts`, `scripts/backfill-gov-embeddings.mjs`
- Pilot signer: `0xC0D26735fd9e868eacc60400ef3171Fa4161177f`

## Gaps found during review (do next)

1. **Secret name mismatch.** Engine reads `SAM_GOV_API_KEY`. Workflow preflight uses `secrets.SAM_API_KEY`. Align both (prefer `SAM_GOV_API_KEY` everywhere, or accept both in code).
2. **`DRY_RUN` default vs workflow default.** Engine: `DRY_RUN !== 'false'` → dry by default. Workflow dispatch default `dry_run: false`. Confirm intended live behavior before enabling real outreach.
3. **Mint is still a stub.** `mintPilotNFT()` throws unless `DRY_RUN` is true. Wire thirdweb/ethers before flipping dry run off.
4. **5-agent consensus is a keyword heuristic stub.** Replace with Guardian / Sentinel / Archivist / Arbiter / Scout when those modules are imported.
5. **No `start:gov-engine` script in package.json.** Local run: `npx tsx server/scripts/run_gov_engine.ts` (or the new ops wrapper).
6. **Workflow default is 06:00 UTC daily.** Manual dispatch is already enabled.

## Local run

```bash
# dry run (default)
bash scripts/ops/run-gov-engine.sh

# live (emails + mint — only after stubs are wired)
DRY_RUN=false bash scripts/ops/run-gov-engine.sh

bash scripts/ops/monitor-gov-engine.sh
```

Required env: `SAM_GOV_API_KEY` (and/or `SAM_API_KEY`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN_PRIMARY`.
