# AuthiChain security and production readiness — evidence register

Status: PARTIAL / NOT A RELEASE APPROVAL.
Snapshot: 2026-11-17 America/Detroit (2026-11-18 UTC).
Main baseline at inspection: 87ce5b5f59faeea5d7aaa7db9c18c7e389606bca.
Evidence is time-sensitive and must be refreshed on the actual deployment SHA.

## Evidence standard

For each release gate, distinguish:
- SOURCE VERIFIED: implementation exists in committed code.
- CI VERIFIED: test or check passed on a known exact SHA.
- CONFIG VERIFIED: live resource, route or binding metadata was inspected.
- LIVE ACCEPTED: actual endpoint or transaction behavior was observed with the required controls.
- BLOCKED / UNKNOWN: a prerequisite has not been independently established.

Neither code presence nor a green build is proof of correct live behavior. Do not claim a paid customer, authorization, compliance certification or production success without independent evidence.

## Gate 1: protected-main integrity

Evidence:
- Protected main at 87ce5b5f59faeea5d7aaa7db9c18c7e389606bca.
- Active branch rules require pull requests and ci/circleci: main-quality-gate.
- Main CI aggregate was successful at this snapshot.
- #2607 at 1fc3f4228eafe45ef25bc865ce02be513e968531 passed all eight CircleCI statuses and GitHub Lint.
- #2606 at 51b927e40618dba83721cf0a1e3c834afca5650b passed GitHub Lint but GitHub Test and CircleCI aggregate remained in progress/pending when checked.
- #2598 Next.js docs-app security update had no required CircleCI status on the Dependabot branch.
- #2604 recorded runner-disconnect-related Lint failure; do not reclassify it as an application defect without logs.

Status: PARTIAL. #2607 CI-clean; final merge eligibility and post-merge main evidence outstanding. Preserve active CI jobs, do not bypass rules.

## Gate 2: edge trust boundary and routing

Source:
- worker-app/guardrail-api.ts registers POST /api/guardrail/check, /record and /suppress; worker-app/index.ts mounts it.
- worker-app/wrangler.toml declares authichain.com/api/guardrail/*.
- workers/authichain-com/src/app-prefixes.ts includes /api and its Worker can proxy through APP_WORKER.

Live configuration inspected through the connected Cloudflare API:
- Active authichain.com zone lists authichain.com/api/guardrail/* assigned to authichain-edge-router.
- app.authichain.com/* is assigned to authichain-edge-router.
- Latest inspected edge-router deployment: cc246145-ddbb-4175-af3f-d6ba9e71f61e; version 24810ff2-4e3d-49f2-9e63-cf9ced4740c8; 100%; timestamp 2026-11-16T13:32:17Z.
- Edge-router settings list INTERNAL_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HYPERDRIVE, SESSIONS, RATE_LIMITER and AI among its bindings. No secret value or sensitive payload was read.

Status: CONFIG VERIFIED / LIVE ACCEPTANCE UNKNOWN.
Next evidence: send a minimal unauthenticated POST with no secrets to /api/guardrail/check on both apex and app host from an authorized internet-enabled environment. Record HTTP code, content type, response class, time and routing metadata without storing tokens or customer details. A configured handler normally requires authentication; an error status alone does not prove its backed database works. Investigate a 404 as routing/version/handler mismatch. Do not use the result to enable outreach.

## Gate 3: guardrail, suppression and outbound email

Source:
- scripts/lib/guardrail-client.ts applies an internal-secret HTTP check and falls back to Supabase on 404, 5xx and fetch failure.
- worker-app/guardrail-api.ts uses the service-role-backed guardrail store, rejects absent/invalid authorization and returns 503 on missing configuration.

Risks to validate:
- Shared store identity across API and fallback.
- Fail-closed behavior when both primary and fallback fail.
- Atomic cap reservation under concurrent calls and retries.
- Suppression checks and replays.
- Required event logging without leaking recipients.
- Distinguish an infrastructure failure from a policy denial.
- Verify live Resend account, sender domain, and internal/external notification permissions before customer emails.

Status: SOURCE VERIFIED / LIVE ACCEPTANCE UNKNOWN.
HOLD: no live campaigns, unsolicited email or mass sending.

## Gate 4: cryptographic verification and product claims

Required:
- Attestation signing key and JWKS correspond in production.
- Verified issuer and subject bindings, expiry, revocation and evidence policy.
- Negative tests for tamper, wrong kid, expired/revoked and subject mismatch.
- QRON scan acceptance in representative real-world conditions.
- Physical continuity and issuer evidence statements accurately scoped.

Status: CI and live acceptance must be reconciled with exact releases. No blanket physical-authenticity certification from a signature-only check.

## Gate 5: financial integrity and entitlement

Live settings show binding names STRIPE_SECRET_KEY, STRIPE_WEBHOOK_AUTHICHAIN_SECRET and STRIPE_WEBHOOK_SECRET on authichain-edge-router. Presence is not proof that values match the active Stripe account/webhook.

Require:
- Authorized Stripe account and actual dashboard webhook subscriptions/endpoint.
- Exact product price and entitlement mapping (including DPP and x402 packs).
- Signature validation, retry/replay idempotency and atomic grants.
- Controlled isolated acceptance for duplicate delivery, crash/rollback and concurrency.
- Fulfillment linked to a genuinely settled external payment for commercial success.
- Refund/dispute handling, cancellation and reconciliation.
- No founder self-pay as proof of market demand.

Status: CONFIG VERIFIED FOR NAMES / BUSINESS OUTCOME UNKNOWN.
HOLD: do not charge customers or change live payment configuration for testing.

## Gate 6: database and identity

Required:
- Verify the actual production Supabase project and database identity, Drizzle/migration history, grants and tenant isolation.
- Verify applied migrations before any schema write.
- Run isolated PostgreSQL acceptance and demonstrate non-destructive recovery.
- Verify scoped service-role use and the boundary between D1/KV/Hyperdrive/PostgreSQL.

Status: PENDING LIVE IDENTITY AND MIGRATION PROOF.
HOLD: no unverified live migrations.

## Gate 7: credential exposure and production authorization

Required:
- Secret scan on exact release tree and independently inspect exposure findings.
- Confirm exposed historical credentials were revoked/rotated at their providers, not merely deleted from files.
- Verify production-cloudflare environment restriction and actual credential scopes.
- Preserve protected release and rollback paths.

Status: PARTIAL. Live Worker binding names verified; secret identity, key rotation, environment policies and rollback acceptance not verified here.
Never include secret values, raw customer records, signing material or privileged URLs in launch evidence.

## Gate 8: platform operational acceptance

Required:
- Live HTTPS/DNS/TLS/Access and route smoke tests on AuthiChain, QRON, StrainChain and GovChain.
- Actual deployed version IDs for each released Worker.
- Alerting, rollback, scheduled jobs and error-visibility proof.
- MCP/A2A tool initialization, permissions and negative-case interoperability.
- x402 discovery, payment verification, accounting and replay protection.
- Public documentation and pricing checked against actual enabled functionality.

Status: OPEN. Some public surfaces are reported live, but this register does not claim a complete end-to-end validated launch.

## Next permitted actions

1. Finish existing #2606 exact-head GitHub Test and CircleCI aggregate without unnecessary retries; merge only when protected eligibility and production-trigger risks are verified.
2. Recheck #2607 after #2606 and merge through normal protections when eligible.
3. From an authorized read-only test environment, collect the guardrail HTTP diagnostic and targeted backend acceptance.
4. Advance the security-update carry-forward only when it will not create competing CI pressure on the single runner.
5. Complete exact-SHA production, payment, data and operations evidence. Release only eligible independent components.

## Evidence pointers

- https://github.com/undone0603/authichain-unified/pull/2606
- https://github.com/undone0603/authichain-unified/pull/2607
- https://github.com/undone0603/authichain-unified/pull/2598
- https://github.com/undone0603/authichain-unified/pull/2604
- https://github.com/undone0603/authichain-unified/blob/main/worker-app/guardrail-api.ts
- https://github.com/undone0603/authichain-unified/blob/main/worker-app/wrangler.toml
- https://github.com/undone0603/authichain-unified/blob/main/scripts/lib/guardrail-client.ts
- https://github.com/undone0603/authichain-unified/actions
