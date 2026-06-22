# Status: SCAFFOLDED — not deployed, not maintained

**Decided:** 2026-04-27 (ecosystem-consolidation Phase 3.3)
**LOC:** 376
**Cloudflare deployments:** none found under name `authichain-telegram`

This worker has substantive code but no deployment record on the
project's Cloudflare account (`4c1869b9…`). Marked archived rather
than deleted to preserve the work.

The dir was renamed from `workers/telegram/` to
`workers/authichain-telegram/` in this PR to match the name
declared in `wrangler.toml`.

To deploy this for real:
1. Ensure secrets are set (`wrangler secret put …`)
2. Run `wrangler deploy` from this directory
3. Add to `.github/workflows/deploy-workers.yml` matrix
4. Delete this STATUS.md

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md`
