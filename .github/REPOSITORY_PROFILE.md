# GitHub Repository Profile

This file is the source-of-truth brief for the GitHub repository's public presentation: About text, topics, homepage, pinned-project messaging, release language, and repository navigation.

## Canonical identity

- Repository: `undone0603/authichain-unified`
- Default branch: `main`
- Production edge: Cloudflare Workers
- Canonical verification path: `POST /api/v1/attestation/verify`
- Canonical production source: this repository
- Current validation state: **do not describe `main` or any new commit as production-validated until the required CI/release gates are green**.

## Recommended About section

**Description**

> AuthiChain is a Cloudflare-first trust protocol for physical products and assets: signed attestations, issuer/lifecycle verification, evidence-backed decisions, and programmable verification surfaces.

**Homepage**

> `https://authichain.com`

**Recommended topics**

- `authichain`
- `verification`
- `digital-product-passport`
- `supply-chain`
- `product-authentication`
- `attestation`
- `cloudflare-workers`
- `typescript`
- `supabase`
- `qr-code`
- `mcp`
- `web3`

Remove or de-emphasize topics that imply capabilities that are not part of the current canonical trust path, especially generic marketing terms that describe historical experiments rather than the protocol.

## Public positioning

Lead with the durable protocol, not the historical stack:

`identify → resolve → attest → verify → interpret → act → pay → retain`

The commercial surfaces are consumers of the same trust layer:

- AuthiChain — protocol, verification, attestations and billing
- QRON — verification presentation and QR experiences
- GovChain — evidence-backed government/contractor workflows
- StrainChain — provenance and regulated-product workflows
- AgentZ / MCP — machine-facing consumption of canonical verification

Do not present a QR match, registry row, NFT, blockchain anchor, DPP publication, or valid signature as an independent authenticity authority.

## Pinned-project language

The repository should be the primary AuthiChain project shown on the owner's GitHub profile. GitHub profile pins identify repositories, not individual commits; the pinned repository therefore needs a current README and a clearly stated validation state. citehttps://docs.github.com/en/account-and-profile/how-tos/profile-customization/pinning-items-to-your-profile

The pinned project should point visitors to the canonical repository and current validation/release state rather than to a stale launch tag or superseded sibling repository.

## Release policy

A GitHub Release must be attached to an exact Git tag and should identify the commit being released. Releases are deployable iterations; a release is not a substitute for CI evidence. citehttps://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

For AuthiChain:

1. Validate the exact candidate commit.
2. Confirm required CI/security/build/contract gates.
3. Confirm deployment/production evidence where applicable.
4. Create the release from the validated tag.
5. State exactly what was validated and what remains a goal or preview.

Do **not** repurpose `v1.0.0-launch`: it points to the June 2026 commit `537f9d1e0b04657c6ba6ea742deced4cc9adaca9`, its annotated tag is unsigned, and there is currently no GitHub Release object attached to it.

## Repository layout

The root README should remain the shortest reliable map into the repository. The public navigation hierarchy is:

1. `README.md` — public overview, architecture, trust boundary, quick start
2. `docs/INDEX.md` — documentation index
3. `docs/ESTATE.md` — canonical source, deployment ownership and superseded estate
4. `docs/NETWORK.md` — production topology
5. `docs/strategy/` — North-Star product and protocol strategy
6. `worker-app/` — canonical verification worker
7. `packages/verifier/` + `protocol/` — verification primitives/reference implementation
8. `apps/`, `src/`, `client/` — product/customer surfaces
9. `workers/` — edge integrations and declared Worker estate
10. `agentz/` + `mcp/` — machine-facing operations

Historical, experimental, duplicated, and migration material can remain in the repository when it is needed for provenance, but it should not compete with the canonical path in top-level navigation.

## Validation language

Use precise states:

- **Validated** — required gates passed for the exact commit/tag.
- **Candidate** — intended for validation, not yet released.
- **Preview / experimental** — usable for exploration but not a production guarantee.
- **Historical** — retained for provenance or migration.
- **Goal** — intended future capability, not current evidence.

Never infer validation from recency, a green local run, a deployment alone, a GitHub pin, or a historical release tag.
