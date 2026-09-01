# Status: SCAFFOLDED — not deployed, archived for later use

**Decided:** 2026-09-01 (ecosystem-consolidation Phase 3.3)
**LOC:** 552
**Cloudflare deployments:** none found under name `authichain-gateway`

This worker is a substantial multi-tenant API gateway with:

- KV-backed rate limiting (`RATE_LIMITS`), tenant cache (`TENANT_CACHE`), and
  usage metering buffer (`USAGE_BUFFER`) — all three KV namespaces have real IDs
  provisioned in `wrangler.toml`, indicating it was actively developed.
- MCP server integration (`./mcp-server`)
- Per-tenant auth resolution (`./auth`)
- Usage recording and buffer flushing (`./metering`)

**Decision: ARCHIVE-WITH-MARKER.** The KV namespace IDs and real metering logic
indicate genuine investment. The functionality overlaps with the `authichain-api-gateway`
worker (DEPLOYED) — reconcile before deploying this one to avoid routing conflicts.

To deploy this for real:

1. Reconcile routing with `workers/authichain-api-gateway/` (they serve different
   purposes or this replaces the older one — confirm first).
2. Ensure secrets are set (`wrangler secret put INTERNAL_SECRET …`)
3. Run `wrangler deploy` from this directory
4. Delete this STATUS.md

Refs: `docs/superpowers/plans/worker-status-2026-04-27.md`
