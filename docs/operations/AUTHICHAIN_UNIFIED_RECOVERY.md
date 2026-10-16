# AuthiChain Unified Stack Recovery

**Audit snapshot:** 2026-10-15 (America/Detroit; GitHub Actions timestamps may fall on 2026-10-16 UTC)  
**Canonical repository:** [undone0603/authichain-unified](https://github.com/undone0603/authichain-unified)  
**Purpose:** one recoverable inventory of the real stack, recovered work, blockers, and acceptance gates. This is a status record—not a claim that every capability is shipped.

## Executive status

The project has substantial existing implementation. It is not production-complete end to end yet. The highest-priority gap is the handoff between **a real product record, the canonical registry, the cryptographic verifier, and paid agent verification**. Signing, registry presence, and physical authenticity are distinct facts and must not be conflated.

| Surface | Current evidence | Status / next gate |
|---|---|---|
| Canonical project layout | The estate and network docs identify this monorepo as the source of truth; Cloudflare-first, Supabase-backed architecture | Use this repo and its current production Workers. Audit older repos for recovery only; do not deploy duplicates by default. |
| Protocol verification | `protocol/verifier.mjs`, test vectors, and a Polygon-anchored demonstration example exist | **Partial.** `polygon-anchor-1` is explicitly a demo, not a real product. A production product record must be signed and independently verified. |
| Production issuer | `packages/verifier/src/index.ts`, `worker-app/attestation-api.ts`, `worker-app/attestation-registry.ts`, and `docs/launch/PRODUCTION_ISSUER.md` exist. Private signing key is kept on `authichain-edge-router`. | **Recovery code added, not released.** PR #1869 now adds authenticated `POST /api/v1/attestations/publish`: signs the v0.1 JWS, checks current trusted issuer status and the seal/product/batch linkage, persists the complete signed payload/JWS/hash, appends `attestation.issued`, and makes the row public only after the durable status write. The separate `protocol/verifier.mjs` format remains a distinct demonstration protocol and is not silently adapted. Real product evidence and migration/route verification remain required. |
| Certificate registry | Legacy Next.js route reads `authichain_certificates`. The safer canonical product/seal table is `auth_seals`; new production-signed records are stored in `authichain_attestation_records`. | **Blocker until migration and real data.** Legacy `authichain_certificates` rows are not trustworthy product attestations and remain excluded. The new migration is additive and limits public SELECT to `published=true`. The Oct 15 history audit documented `auth_seals` as empty (0 rows); the new table/migration have not been applied in production and there is still no owner-authorized product record. |
| Public registry HTTP endpoint | Draft PR [#1869](https://github.com/undone0603/authichain-unified/pull/1869) adds read-only `/api/authichain/certificates` (seal registration) and `/api/authichain/attestations?assetId=…` (complete published JWS record) Worker routes backed by Supabase. | **Recovery work in draft PR.** The JWS endpoint searches only `published=true` signed records and fails closed on missing, ambiguous, or unavailable lookup. Both paths remain unreleased; migration, CI, route tests, and live smoke validation are gates. |
| Agent MCP registry lookup | The same #1869 recovery branch now wires `query_provenance` to read published JWS records plus `auth_seals`, and adds free `verify_attestation` that delegates signature, issuer trust, durable status, and expiry checks to the canonical edge-router verifier. The MCP manifest and server version are bumped to 1.4.0 together. | **Implemented in draft branch, not released or locally executed.** Lookup alone returns `verified=false`; the verifier tool reports physical authenticity as `not_proven`. New tests cover publication, registry result/error paths, and verifier binding, but Actions runner failures mean test success has not yet been established. |
| Paid verification / x402 | Fail-closed guards exist. MCP advertises paid plans as on hold and refuses paid verification with `registry_not_bound` before settlement when it cannot answer. | **Keep disabled.** Enable only after a real signed product record, registry-backed crypto verification, negative/error-path tests, spend ledger/cap tests, and a live end-to-end smoke check all pass. |
| Agent minting / NFTs | `scripts/mint-govchain-nfts.ts` and `.github/workflows/gov-mint.yml` exist for GovChain opportunity NFTs. | **Not an agent identity minting system by itself.** Live Base minting is explicitly blocked until a real contract is deployed and Base `eth_getCode` proves bytecode. Do not guess/set a contract address or treat the Polygon contract as the missing Base deployment. |
| AgentZ and outreach | AgentZ orchestration, B2B/email workflows, and guardrail/suppression code exist. | **Gated.** The scheduled AgentZ orchestration is intended to be dry-run/health work. Outreach workflows have explicit live-send gates and duplicate-recipient protections. Verify current workflow state before any live dispatch; this audit did not send messages or mint assets. |
| CI and deploy | The latest-head GitHub Actions batch completed with failures across CI Main, CI, CodeQL, Lint, Security Scan, trust-lab, Schema Drift, Supabase baseline, compliance and launch checks. CI Main test shard 1, test shard 2, typecheck/lint, and build jobs report empty `steps` arrays; job logs still return `BlobNotFound`. Earlier jobs reported `runner_id: 0`, no runner name, and failed before checkout/test execution. The [GitHub Status page](https://www.githubstatus.com/) reported Actions operational with no Oct 16 incident. | **Release-blocking; the new code is not validated.** The evidence points to a job-start/runner problem but does not prove root cause or say whether the source compiles. Investigate repository/account Actions runner/job provisioning. Once jobs execute, fix actual failures, rerun all gates, and live-smoke-test before merge/deploy. |

## Canonical stack and recovery map

- **Source of truth:** this monorepo, particularly `workers/authichain-com/`, `workers/authichain-verify-worker/`, `worker-app/`, `packages/verifier/`, `protocol/`, `supabase/migrations/`, and `.github/workflows/`.
- **Production topology:** Cloudflare Workers, including `authichain-com` and `authichain-edge-router`; Supabase/Postgres for registry and status; Stripe/x402 for payment paths. Older Vercel references and duplicate app routes are not proof of production deployment.
- **Protocol artifacts:** `protocol/verifier.mjs`, `protocol/examples/`, `packages/verifier/`, `docs/attestation/`, and `docs/launch/PRODUCTION_ISSUER.md`. These need an explicitly tested bridge; do not treat a valid signature alone as evidence about a physical object.
- **Canonical registration source:** `public.auth_seals`. It is a registration index, not a signature or revocation registry. A row is not proof that the product in a person's hand is genuine.
- **Do-not-route source:** `public.authichain_certificates` / the older Next.js certificate route. The historical seed dataset names real brands and must not be represented as real certificates without evidence and owner-approved clean-up.
- **Deployment gates:** inspect `.github/workflows/deploy-cloudflare.yml`, `deploy-workers.yml`, the current Worker bindings, and workflow variables/secrets in GitHub/Cloudflare. The repository connection used for this audit cannot read secret values; never infer a secret is set from its name appearing in source.
- **History recovery:** #1869 contains the registry route and MCP recovery changes; #1866 documents MCP registry/version drift and the dangerous legacy seed-data mismatch. Other archived branches and old repos are forensic sources only until a reviewed source/test change is deliberately ported.

## Cross-repository and history inventory

The repository search found these related codebases. They are retained here so future recovery work has one place to start; **the current production stack remains `authichain-unified`**.

- [`undone0603/authichain-unified`](https://github.com/undone0603/authichain-unified) — active canonical monorepo and the only repo changed by PR #1869.
- [`undone0603/authichain-com`](https://github.com/undone0603/authichain-com) — archived snapshot; its README explicitly says **superseded / do not deploy** and points back to `authichain-unified/workers/authichain-com`.
- [`undone0603/authichain_premium`](https://github.com/undone0603/authichain_premium) — archived historical NFT marketplace prototype; README says **superseded / not production**.
- [`undone0603/authichain-os`](https://github.com/undone0603/authichain-os) — archived stub with a two-line README; no missing application implementation was recoverable from its README.
- [`undone0603/authichain-spec`](https://github.com/undone0603/authichain-spec) — active protocol/reference-verifier repository. Its README explains that the bundled demo record verifies as `valid-unanchored`; use its spec and vectors as protocol reference, not as proof that a customer product has been signed or certified.
- [`undone0603/authichain-mcp-server`](https://github.com/undone0603/authichain-mcp-server) — separate early-stage MCP wrapper. Its README itself says certificate issuing is still in development and mint-certificate is unavailable. Do not deploy it as a second public MCP server instead of the canonical Worker.
- [`AuthiChain2026/authichain-mcp-server`](https://github.com/AuthiChain2026/authichain-mcp-server), [`AuthiChain2026/AuthiChain`](https://github.com/AuthiChain2026/AuthiChain), [`AuthiChain2026/authichain-os`](https://github.com/AuthiChain2026/authichain-os), [`undone0603/AuthiChain-1`](https://github.com/undone0603/AuthiChain-1), [`undone0603/undone0603.github.io`](https://github.com/undone0603/undone0603.github.io), and [`Z-kie/authichain-landing`](https://github.com/Z-kie/authichain-landing) were also discoverable in repository search. Some are read-only from this connection; several have duplicate/starter branding or claims that are not production evidence. Their contents/settings are not being merged or deployed without path-by-path review.
- Search could see the archived [`undone0603/authichain-protocol`](https://github.com/undone0603/authichain-protocol) metadata, but the GitHub contents API returned 404 for its README. The monorepo already contains `protocol/verifier.mjs` and `protocol/examples/`; the accessible `authichain-spec` repo is the alternate reference. No unique production signing/publishing file was proven to be missing from the canonical repo by that 404 alone.

**Recovery decision:** port only source that has a clear authoritative role, known license, tests, correct secret boundary, and deployment path. Keep the old/duplicate repos as forensic references; copying their marketing claims, seed data, mock integrations, demo keys, or independent deploy paths would make the stack less trustworthy, not more complete.

## Work recovered in PR #1869

Branch: `activate/registry-backed-agent-verification`  
PR: https://github.com/undone0603/authichain-unified/pull/1869

The branch contains:
1. A read-only Worker endpoint for `GET /api/authichain/certificates` using the public Supabase key and canonical `auth_seals`.
2. A new additive migration, `supabase/migrations/20261016000000_authichain_signed_product_records.sql`, for `authichain_attestation_records`; public reads are restricted by RLS to published rows.
3. Authenticated `POST /api/v1/attestations/publish`, which checks issuer trust, requires an existing seal, links `subject.object_id` to the registered product and `subject.lot` to its batch, signs with the existing EdDSA issuer key, stores the full JWS/payload/hash, appends an `attestation.issued` lifecycle event, and only then exposes the record publicly.
4. A read-only Worker endpoint at `GET /api/authichain/attestations?assetId=…` returning only complete published signed records. Missing, invalid, ambiguous, and registry-unavailable outcomes remain separate.
5. MCP `query_provenance` retrieves signed records and seal registrations as not-yet-verified evidence; new `verify_attestation` hands the stored JWS to the canonical edge-router verification endpoint and explicitly does not claim physical authenticity.
6. Focused tests were added for route lookup, ambiguity/outages, issuance authorization/linkage/signature verification, MCP signed-record retrieval, and verifier hand-off. MCP implementation and `server.json` are both versioned 1.4.0.
7. An updated PR description states the remaining gates and why this draft must not be merged without real CI and deployment evidence.

**Do not merge merely because the branch exists or is mergeable.** The PR is intentionally still a draft while required checks and live smoke evidence are unresolved.

## Live public spot-check (2026-10-15 America/Detroit)

- `GET https://authichain.com/mcp` returned discovery JSON with production server version `1.3.0`. Its current tool description says arbitrary provenance IDs return `unknown` because registry lookup is not connected. Paid plans are `on_hold`, and the legacy paid verify note says `503 registry_not_bound` before settlement.
- `GET https://authichain.com/api/authichain/certificates` returned **404 Not Found**.
- The recovery branch now contains new signed-record publication/retrieval and MCP verification code, but those changes are not deployed. The new signed-record migration has not been applied in production and no actual signed product has been published in this recovery session.
- GitHub Actions initially failed before executing any steps (`runner_id: 0`, empty step arrays); the job-log endpoint returned `BlobNotFound`. A later latest-head batch appeared queued when queried. The root cause is not confirmed. No CI pass is claimed; the new branch changes have not been tested locally.
- The current public GitHub status page reported Actions operational/no Oct 16 incident, while the relevant PR jobs themselves had no allocated runner and no executed steps. Treat this as a repository/account job-start blocker until an actual job log or a run with executed steps identifies the cause.
## Definition of “done”

### Gate 1 — one protocol path
- Pick and document the canonical signed product-record envelope, issuer identifiers, signing bytes/hash rules, revocation/status semantics, and expected evidence.
- Add a tested adapter if the compact production EdDSA JWS and `protocol/verifier.mjs` Verifiable Credential formats both need support. Do not silently translate fields or reuse the launch-proof fixture as a product.
- Make the verifier return distinct states for invalid signature, untrusted issuer, missing/invalid anchor, revoked/expired record, and valid signed record with required anchor evidence.

### Gate 2 — registry end to end
- Confirm the required Supabase migration/table/RLS policies are applied in production. Use only `auth_seals` or a reviewed signed-record table; never expose the 1,601-row legacy seed set as certificates.
- Have an owner-authorized manufacturer/product claim and evidence packet. Issue a production-signed record for that real product; persist the record, signer key id, hash, and revocation/status reference in the selected registry.
- Retrieve the record by a canonical product/seal identifier from the public registry route and MCP lookup. Confirm it matches the record that was signed.
- Verify it independently from the submitted/published record and anchor. Test tampered record, wrong key/issuer, absent or mismatched anchor, unknown ID, timeout, and revoked/expired states. Report registration and cryptographic verification separately.
- Run the focused tests, full test suite, typecheck, lint, security scans, and production build. Diagnose the currently inaccessible red workflow runs; do not waive them without evidence.

### Gate 3 — agent payments
- Keep paid verification disabled through Gates 1 and 2.
- Prove settlement occurs only after a registry-backed verification can return an authentic, real answer. Verify unpaid calls return the correct payment challenge and failures never settle funds.
- Test idempotency, refund/dispute path as applicable, daily cap/spend ledger behavior, replay/malformed proofs, registry downtime, and no-charge-on-unanswerable-record.
- Enable paid verification only after a production canary, live-path confirmation, and owner approval of price/treasury/limits.

### Gate 4 — agents, mint and outreach
- Define what “mint my agents” means at the product level: agent identity schema, chain/network, actual deployed contract, owner wallet, minting rights, metadata, and revocation/reassignment behavior. GovChain opportunity NFTs are not a substitute for agent identity.
- For Base minting, deploy/verify the approved contract and confirm non-empty `eth_getCode` on Base mainnet before enabling live `gov-mint`. Dry-run first; prove the minted token/owner/metadata and log it.
- Keep AgentZ orchestration dry-run until the owner has reviewed the run. Confirm live current Actions state instead of trusting dated docs.
- Outreach must first execute dry-run targeting and suppression checks. Never resend the already-contacted QRON and channel-partner recipients enumerated by `scripts/lib/b2b-send-policy.ts`. Owner must explicitly approve live recipients, message, cap, sender, and dispatch; avoid the default `segment=all`.

### Gate 5 — production evidence
- Merge only after all required CI is green. Deploy via the canonical Cloudflare workflow/worker path, not a stale Vercel project or direct ad-hoc deployment.
- Capture exact deployed commit SHA and workflow run, then smoke-test the public registry route, MCP discovery/tool calls, issuer/JWKS consistency, record creation/retrieval, cryptographic verification, and paid path (only after Gates 1–3).
- Update this file with reproducible evidence, timestamps, non-secret configuration names, test results, and remaining risk. Do not change a checklist to complete based only on code presence.

## Audit limitations

No matching AuthiChain project files were present in the current local workspace or searchable file Library. The recovery work therefore used the canonical GitHub repo, branches, pull requests, source, and commit-associated Actions records. This audit did not read secret values, deploy code, run a live transaction, publish a real product claim, enable paid verification, mint an NFT, or send outreach. Those are explicit gates, not assumed completed actions.
