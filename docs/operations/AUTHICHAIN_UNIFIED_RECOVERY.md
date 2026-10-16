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
| Production issuer | `packages/verifier/src/index.ts`, `worker-app/attestation-api.ts`, `worker-app/attestation-registry.ts`, and `docs/launch/PRODUCTION_ISSUER.md` exist. Private signing key is kept on `authichain-edge-router`. | **Partial.** The production issuer's compact EdDSA JWS format is not the same data shape as the reference `protocol/verifier.mjs` Verifiable Credential. Define and test the canonical adapter/persistence path before claiming end-to-end product verification. |
| Certificate registry | Legacy Next.js route reads `authichain_certificates`. The safer canonical product/seal table is `auth_seals`. | **Blocker.** The legacy table was documented as 1,601 seed rows naming real brands, not verified customer certificates. Do not publish those rows. The Oct 15 history audit documented `auth_seals` as empty (0 rows). |
| Public registry HTTP endpoint | Draft PR [#1869](https://github.com/undone0603/authichain-unified/pull/1869) adds a read-only Worker route backed by `auth_seals`, bounded filters, no-store/CORS, explicit registration-only semantics, and fail-closed errors. | **Recovery work in draft PR.** Must pass CI and production smoke tests before merge/deploy. Main's public endpoint was returning 404 at the time of the audit. |
| Agent MCP registry lookup | The same #1869 recovery branch now wires `query_provenance` to a read-only `auth_seals` query when public Supabase settings are present, and adds tests for match, outage, and no charge on a free lookup. | **Implemented on recovery branch, not released.** A row returns `registered`, never `verified`. Missing configuration and database failures are distinct from “not registered.” |
| Paid verification / x402 | Fail-closed guards exist. MCP advertises paid plans as on hold and refuses paid verification with `registry_not_bound` before settlement when it cannot answer. | **Keep disabled.** Enable only after a real signed product record, registry-backed crypto verification, negative/error-path tests, spend ledger/cap tests, and a live end-to-end smoke check all pass. |
| Agent minting / NFTs | `scripts/mint-govchain-nfts.ts` and `.github/workflows/gov-mint.yml` exist for GovChain opportunity NFTs. | **Not an agent identity minting system by itself.** Live Base minting is explicitly blocked until a real contract is deployed and Base `eth_getCode` proves bytecode. Do not guess/set a contract address or treat the Polygon contract as the missing Base deployment. |
| AgentZ and outreach | AgentZ orchestration, B2B/email workflows, and guardrail/suppression code exist. | **Gated.** The scheduled AgentZ orchestration is intended to be dry-run/health work. Outreach workflows have explicit live-send gates and duplicate-recipient protections. Verify current workflow state before any live dispatch; this audit did not send messages or mint assets. |
| CI and deploy | PR-head GitHub Actions reported failures in CI Main (test shards, build, typecheck/lint), CI, CodeQL, Lint, Typecheck ratchet, and Security Scan. In the Oct 16 UTC rerun, CI Main jobs had `runner_id: 0`, blank runner names, empty step arrays, and failed within about 2–4 seconds—before checkout or any test/build step. The workflow log endpoint returned `BlobNotFound`. The [GitHub Status page](https://www.githubstatus.com/) currently reports Actions operational with no Oct 16 incident, so a broad active incident is not established. | **Release-blocking, but not demonstrated to be a code failure.** Investigate this repository/account's runner/job provisioning and Actions settings; a green check cannot be inferred from a job that never starts. After jobs genuinely start, diagnose any real lint/type/test/build failures, rerun the full gate, and smoke-test production before merge/deploy. |

## Canonical stack and recovery map

- **Source of truth:** this monorepo, particularly `workers/authichain-com/`, `workers/authichain-verify-worker/`, `worker-app/`, `packages/verifier/`, `protocol/`, `supabase/migrations/`, and `.github/workflows/`.
- **Production topology:** Cloudflare Workers, including `authichain-com` and `authichain-edge-router`; Supabase/Postgres for registry and status; Stripe/x402 for payment paths. Older Vercel references and duplicate app routes are not proof of production deployment.
- **Protocol artifacts:** `protocol/verifier.mjs`, `protocol/examples/`, `packages/verifier/`, `docs/attestation/`, and `docs/launch/PRODUCTION_ISSUER.md`. These need an explicitly tested bridge; do not treat a valid signature alone as evidence about a physical object.
- **Canonical registration source:** `public.auth_seals`. It is a registration index, not a signature or revocation registry. A row is not proof that the product in a person's hand is genuine.
- **Do-not-route source:** `public.authichain_certificates` / the older Next.js certificate route. The historical seed dataset names real brands and must not be represented as real certificates without evidence and owner-approved clean-up.
- **Deployment gates:** inspect `.github/workflows/deploy-cloudflare.yml`, `deploy-workers.yml`, the current Worker bindings, and workflow variables/secrets in GitHub/Cloudflare. The repository connection used for this audit cannot read secret values; never infer a secret is set from its name appearing in source.
- **History recovery:** #1869 contains the registry route and MCP recovery changes; #1866 documents MCP registry/version drift and the dangerous legacy seed-data mismatch. Other archived branches and old repos are forensic sources only until a reviewed source/test change is deliberately ported.

## Work recovered in PR #1869

Branch: `activate/registry-backed-agent-verification`  
PR: https://github.com/undone0603/authichain-unified/pull/1869

The branch contains:
1. A read-only Worker endpoint for `GET /api/authichain/certificates` using the public Supabase key and canonical `auth_seals`.
2. Input validation, bounded pagination, CORS and no-store headers; database errors fail closed rather than returning a misleading empty registry.
3. Registration-only semantics; legacy `?valid=` filtering is rejected so a database row cannot be presented as cryptographic validity.
4. MCP `query_provenance` lookup through the same canonical table when configured. It distinguishes not configured, invalid identifier, unavailable, not found, and matched states.
5. Tests for the registry route plus added MCP tests for a positive match, outage handling, and read-only/free behavior when a payment header is supplied.
6. An updated PR description that states the gates, seed-data issue, and current check failures.

**Do not merge merely because the branch exists or is mergeable.** The PR is intentionally still a draft while required checks and live smoke evidence are unresolved.

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
