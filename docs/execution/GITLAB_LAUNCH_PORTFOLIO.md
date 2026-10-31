# AuthiChain GitLab Launch Portfolio

Generated 2026-10-22 from the GitHub repository `undone0603/authichain-unified` and the current GitLab project `authichain-group/authichain-unified`.

## Operating rule

GitLab `main` is the working source of truth. GitHub is treated as a downstream mirror. Launches are assembled as small, independently verifiable product lanes over the shared AuthiChain verification protocol.

## Launch lanes

### Launch 01 — AuthiChain Verification Core
Purpose: sell and operate the trust primitive first.

Canonical source areas:
- `protocol/`
- `workers/authichain-verify-worker/`
- `worker-app/`
- `src/lib/`
- `mcp/`

Entry evidence:
- GitLab main CI is passing.
- MR !2006 recovered seven unversioned production verification-family functions into migration history.
- MR !2009 made the autonomy ledger suppress stale/superseded failures and non-error log noise.

Gate:
- Preserve issuer/JWKS, revocation, Stripe webhook verification, `humanHold`, and `production_send=false`.

### Launch 02 — QRON Living QR
Purpose: turn verification into a visually differentiated commercial surface.

Canonical source areas:
- `src/lib/generate-api.ts`
- QRON worker/app routes
- `apps/qron-platform/`
- `public/` and QR presentation assets

Entry evidence:
- Main repository already exposes QRON generation and verification paths.
- Existing generation code returns a QR image, destination URL, and protocol presentation object.
- The free sample/upgrade path is represented by MR !1970 and should stay behind the checkout gate.

Commercial sequence:
free sample → verified value → Starter pack → paid generation/verification.

### Launch 03 — AgentZ / MCP
Purpose: make AuthiChain machine-native and autonomous.

Canonical source areas:
- `agentz/`
- `mcp/`
- `scripts/mint-agentz.ts`
- `.github/workflows/` / GitLab CI equivalents

Entry evidence:
- MR !1966 contains the canonical AgentZ identity mint implementation and defaults to dry-run.
- The mint path refuses to substitute an unrelated treasury/deployer address.
- The README exposes the AgentZ CLI and MCP as first-class repository surfaces.

Gate:
- Identity minting is an explicit irreversible action; keep the signing/recipient requirement intact.
- No autonomous wallet signing is assumed.

### Launch 04 — Digital Product Passport
Purpose: package AuthiChain verification for enterprise supply-chain use.

Canonical source areas:
- `protocol/`
- `server/`
- `workers/authichain-verify-worker/`
- passport/evidence modules
- `drizzle/migrations/`

Current stack:
- MR !1980 integrates evidence writers/tallying.
- Child work includes DSCSA, UDI, hash-publication, telemetry, visual-similarity and attestation evidence.
- The parent branch deliberately keeps metering/anchoring switches off until independently approved.

Commercial target:
EU DPP readiness as a one-time enterprise workflow, with claims scoped to evidence rather than compliance certification.

### Launch 05 — GovChain
Purpose: create a government/contractor trust surface over the same verification protocol.

Canonical source areas:
- `workers/govchain-us/`
- government-facing estate/pricing/configuration
- verification and manufacturer-status routes

Gate:
- Verify Cloudflare service binding/build evidence before production deployment.
- No government certification claim is inferred from a green build.

### Launch 06 — StrainChain
Purpose: regulated physical-product provenance using the same trust layer.

Canonical source areas:
- `strainchain.io` worker/app surface
- provenance/verification modules
- QRON presentation layer

Commercial sequence:
identity/provenance → verification → traceability workflow → enterprise account.

## Launch control

Automatic:
1. GitLab MR pipeline
2. secret scan
3. structural invariants
4. quality/test gate
5. production build
6. launch-specific validation

Intentional holds:
- `humanHold`
- `production_send=false`
- Stripe webhook signature verification
- irreversible wallet/blockchain actions
- production deployment when credentials/approval are absent

## GitHub extraction policy

GitHub material is imported as evidence/source material, not as a competing control plane. The repository's existing files remain canonical where GitLab already contains them. When a GitHub-only artifact is needed, reproduce it on a GitLab feature branch and attach it to the appropriate launch MR with provenance notes.

## Current prioritized queue

1. Verification Core — already on main; continue hardening.
2. QRON Living QR — align free-sample conversion with closed/open plan truth.
3. AgentZ/MCP — validate the dry-run identity path, then isolate any irreversible mint as a separately approved operation.
4. DPP — keep the evidence stack on its branch until parent/child sequencing and deployment gates are satisfied.
5. GovChain — resolve Cloudflare build/service-binding evidence.
6. StrainChain — package the surface around the common verification protocol.

## Definition of launch-ready

A launch lane is ready when:
- code is on a GitLab branch/MR,
- CI is green for that exact head,
- required evidence is recorded,
- commercial claims match deployed behavior,
- irreversible actions remain explicit,
- deployment ownership is identified,
- rollback is documented.

This portfolio is an orchestration index; it does not by itself deploy, charge, mint, or send outbound messages.
