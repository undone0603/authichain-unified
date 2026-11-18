# AuthiChain production architecture — evidence baseline

Status: architecture map, not a production release certification.
Snapshot: 2026-11-17 America/Detroit (2026-11-18 UTC).
Canonical repository: https://github.com/undone0603/authichain-unified
Observed protected main: 87ce5b5f59faeea5d7aaa7db9c18c7e389606bca.

## Mission and invariants

AuthiChain provides one evidence-backed verification protocol across several commercial presentation surfaces. Resolve an identifier, obtain a signed issuer claim, evaluate signature/key/status/revocation and provenance evidence, then return a scoped decision. Resolution, signature validity, issuer authorization and physical product authenticity are different claims. A transferable QR label or copied signed claim alone cannot prove physical continuity.

Vertical brands are clients of the shared verification trust boundary; none should fork it.

## Source of truth and conflicting documentation

Use current code, the actual deployed Cloudflare configuration, and current protected-branch rules when these disagree with historical inventory. Read README.md, docs/ESTATE.md, docs/NETWORK.md, docs/ROUTING.md, config/cloudflare-estate.json, pnpm-workspace.yaml and the individual Wrangler manifests together.

Some historical portions of docs/NETWORK.md describe retired Vercel arrangements. Cloudflare Workers are the current intended production authority. This document does not authorize a Vercel deployment, DNS change, worker retirement, secret update, or database migration.

## Core request and trust flow

1. A consumer scans a QR or an agent submits a GS1 Digital Link, GTIN/serial/lot, or provider-scoped identifier.
2. Resolver and product-facing routes identify the intended object and return linked representations.
3. AuthiChain checks a signed attestation, issuer identity/JWKS, temporal validity, revocation/status, subject mapping, policy and referenced provenance evidence.
4. Web verification, enterprise APIs, MCP/A2A clients and vertical brands consume the same evidence-backed decision.
5. Commercial features separately enforce payment authorization, entitlement grants and their own audit trails.

Source components to verify: protocol/, packages/verifier/, worker-app/, mcp/, agentz/, workers/, client/ and associated tests.

## Edge routing and deployed Cloudflare surfaces

- authichain.com: marketing and product entry points, with workers/authichain-com owning the apex marketing layer and authichain-edge-router providing appropriate app/API paths.
- app.authichain.com/*: Cloudflare route currently assigned to authichain-edge-router; apex landing uses a service binding named APP_WORKER for forwarded application paths.
- authichain.com/api/guardrail/*: Cloudflare zone route currently assigned directly to authichain-edge-router. Its Hono POST /api/guardrail/check, /record and /suppress handlers are defined in worker-app/guardrail-api.ts and registered by worker-app/index.ts.
- authichain.com/api/stripe/webhook and other specific payment/attestation/checkout paths: audit actual Worker route ownership and live Stripe configuration before claiming payment completion.
- qron.space, strainchain.io and govchain.us: distinct public vertical brands; inspect their Worker manifests and live routing before certifying any workflow.
- MCP/AgentZ/x402: machine-facing interfaces sharing the same trust primitives, with independently verifiable access, policy and accounting requirements.

Read-only Cloudflare inspection on 2026-11-17 showed the direct guardrail route in the active authichain.com zone and a 100% edge-router deployment for version 24810ff2-4e3d-49f2-9e63-cf9ced4740c8, created 2026-11-16T13:32:17Z. This confirms route/deployment metadata, not the response behavior of a live POST.

The edge-router deployed binding names include INTERNAL_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HYPERDRIVE, SESSIONS, RATE_LIMITER and AI. Secret values were not retrieved or recorded. Presence of a binding is not proof of the correct secret identity, permissions or successful backend calls.

## Data and state boundaries

Use Supabase/PostgreSQL as the authoritative transactional product state where the canonical schema design specifies it. Treat Drizzle and repository migration history as the migration evidence baseline. Cloudflare D1, KV, Durable Objects and Hyperdrive have bounded responsibilities defined by each Worker. Do not create a parallel product schema or infer live migration completion from a local file.

Required acceptance for a database-affecting release: exact target-project identity, applied-version reconciliation, safe concurrency/replay tests, backup and recovery plan, and separately authorized production migration.

## Commercial and agent boundaries

The intended customer loop is discovery -> onboarding -> checkout -> settled payment -> idempotent entitlement -> verified fulfillment -> renewal/retention. Stripe webhook signatures, correct account/price identity, dispute/refund handling and audit reconciliation are separate gates; test-mode or zero-dollar sessions are not proof of paying customers.

The guardrail API and local guardrail clients enforce campaign caps and suppression. scripts/lib/guardrail-client.ts currently includes a direct Supabase fallback on HTTP 404/5xx or transport failure. Demonstrate equivalence and fail-closed behavior under errors, races and suppressed recipients before any production outbound enablement.

AgentZ operations must use scoped identities, signed messages, delegated authority, rate/spend limits, idempotent state transitions and a traceable approval policy. MCP, A2A and x402 must pass their own interoperability, authentication and accounting acceptance.

## Protected integration and release mechanics

Protected main requires a pull request and the status context ci/circleci: main-quality-gate. Recheck the exact PR head, enforced rules, final merge eligibility and resulting main SHA. A green status on an older head is not a substitute.

Production triggers are not uniform:
- deploy-authichain-com.yml is a manual exact-main expected_sha protected deployment.
- deploy-workers.yml runs for matching workers/** changes with additional deployment selection constraints.
- deploy-cloudflare.yml is path-scoped to workers/manufacturer-status/**.
- deploy-edge-worker.yml is path-scoped to api/** or src/lib/plans.ts.
- deploy-verifier-web.yml covers its named app/package/workflow paths.

Read each current workflow before any merge because other push-to-main workflows may still run. Protected PR merge != verified release.

## Evidence and release gates still open

- Final CI and protected merge outcome for #2606 and #2607 at their exact final heads.
- Live unauthenticated POST result for /api/guardrail/check on apex and app host; distinguish 401/503/404, then verify intended auth and store behavior without logging credentials.
- Authenticated store guardrail tests: caps, suppression, reservation atomicity, fallback and audit.
- Production Stripe/email provider identities, effective scopes, paid fulfillment, refund and dispute acceptance.
- Complete live-domain smoke tests, production deploy provenance and rollback.
- Per-product launch readiness and accurate public claims.

Do not upgrade this evidence map to a production-readiness statement without live acceptance records.

## Primary evidence pointers

- https://github.com/undone0603/authichain-unified/blob/main/README.md
- https://github.com/undone0603/authichain-unified/blob/main/docs/ESTATE.md
- https://github.com/undone0603/authichain-unified/blob/main/docs/ROUTING.md
- https://github.com/undone0603/authichain-unified/blob/main/worker-app/guardrail-api.ts
- https://github.com/undone0603/authichain-unified/blob/main/worker-app/wrangler.toml
- https://github.com/undone0603/authichain-unified/blob/main/scripts/lib/guardrail-client.ts
- https://github.com/undone0603/authichain-unified/actions
