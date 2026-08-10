# Status: SCAFFOLDED — not deployed, not maintained

**Decided:** 2026-04-27 (ecosystem-consolidation Phase 3.3)
**LOC:** 226
**Cloudflare deployments:** none under `authichain-qron-provenance` or `-staging`

The `wrangler.toml` declares both production and staging environments,
suggesting active development at some point. Marked archived rather
than deleted to preserve the work.

The dir was renamed from `workers/qron-provenance/` to
`workers/authichain-qron-provenance/` in this PR to match the name
declared in `wrangler.toml`.

To deploy this for real:
1. Ensure secrets are set (`wrangler secret put …`)
2. Run `wrangler deploy` (or `wrangler deploy --env staging`)
3. Add to `.github/workflows/deploy-workers.yml` matrix
4. Delete this STATUS.md

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md`
