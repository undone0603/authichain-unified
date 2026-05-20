# Status: SCAFFOLDED — not deployed, not maintained

Decided 2026-04-27 in ecosystem-consolidation Task 0.6.

## Origin

Code was found at top-level `src/index.ts` during Phase 0 of the
consolidation effort. It's a Hono Cloudflare Worker that:

- Authenticates Bearer-token JWTs via `@tsndr/cloudflare-worker-jwt`
- Forwards POSTs to `${SUPABASE_URL}/functions/v1/strain-bridge`
- Exposes `/health` (check) and `/rapid/:endpoint` (RapidAPI passthrough)

It was never deployed (verified by `wrangler deployments list`
against the candidate names `authichain-bridge`, `strain-bridge`,
`qron-bridge`, `authichain-strain-bridge`).

## Disposition

Relocated under `workers/<name>/` to remove top-level structural
ambiguity, while preserving the code for recovery. Deleting it
outright was the alternative; chose to keep because it's working
code that may want to come back as a real bridge worker.

## To deploy this for real

1. Set the four secrets listed in `wrangler.toml`
2. From this dir: `wrangler deploy`
3. Add a route in `wrangler.toml` if exposing on a brand domain
4. Add to `.github/workflows/deploy-workers.yml` matrix
5. Remove this STATUS.md

## Refs

- `docs/superpowers/plans/worker-status-2026-04-27.md` — Q3 disposition
- `docs/superpowers/plans/2026-04-27-ecosystem-consolidation.md` — Task 0.6
