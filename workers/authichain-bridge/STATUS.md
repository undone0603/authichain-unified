# Status: READY-TO-DEPLOY (secrets gate only)

Updated 2026-09-16. Originally scaffolded 2026-04-27 (ecosystem-consolidation Task 0.6).

## What's done

- `src/index.ts` — Hono worker: JWT auth, Supabase bridge, RapidAPI passthrough
- `src/qron-bridge.ts` — supplementary bridge logic
- `wrangler.toml` — Worker config with `nodejs_compat`, observability on
- `package.json` — added 2026-09-16; declares `hono`, `@tsndr/cloudflare-worker-jwt`, `@cloudflare/workers-types`

## To deploy

1. Set the four secrets (from this dir):
   ```
   wrangler secret put JWT_SECRET --name authichain-bridge
   wrangler secret put SUPABASE_URL --name authichain-bridge
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name authichain-bridge
   wrangler secret put RAPIDAPI_KEY --name authichain-bridge
   ```
2. Add `authichain-bridge` to `.github/workflows/deploy-workers.yml` matrix
3. Delete this STATUS.md on first successful deploy

## Refs

- `docs/superpowers/plans/worker-status-2026-04-27.md` — Q3 disposition
- `docs/superpowers/plans/2026-04-27-ecosystem-consolidation.md` — Task 0.6
