# Status: SCAFFOLDED — not deployed, archived for later use

**Decided:** 2026-09-01 (ecosystem-consolidation Phase 3.3)
**LOC:** 174
**Cloudflare deployments:** none found under name `authichain-verify-worker`

This worker handles product verification requests at the edge (`/api/verify`).
It normalizes product identifiers (QR URL or raw code), queries Supabase for the
product record, and returns verification status with certificate data.

**Decision: ARCHIVE-WITH-MARKER.** Edge-based product verification is a natural
fit for the QRON platform's scan-and-verify flow. The implementation is clean and
self-contained (174 LOC, no complex dependencies). Deploy when the scan-validate
worker (`workers/authichain-scan-validate/`) needs an edge complement, or when the
Next.js `/api/verify` route becomes a latency bottleneck.

To deploy this for real:

1. Ensure secrets are set (`wrangler secret put SUPABASE_URL SUPABASE_ANON_KEY`)
2. Run `wrangler deploy` from this directory
3. Add to `.github/workflows/deploy-workers.yml` matrix
4. Delete this STATUS.md

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md`
