# AuthiChain Unified — Documentation Index

The repository is `undone0603/authichain-unified`. This is the canonical AuthiChain source; Cloudflare Workers are the production edge. Documentation must distinguish validated behavior from candidates, previews, historical material and goals.

## Start here

- [README.md](../README.md) — public architecture, trust boundary and quick start
- [strategy/NORTH_STAR_MVPS.md](strategy/NORTH_STAR_MVPS.md) — current MVP sequence
- [ESTATE.md](ESTATE.md) — canonical source, Worker ownership and superseded estate
- [NETWORK.md](NETWORK.md) — deployment topology
- [attestation/v0.1.md](attestation/v0.1.md) — attestation/conformance reference
- [../.github/REPOSITORY_PROFILE.md](../.github/REPOSITORY_PROFILE.md) — GitHub About/release/layout brief

## Canonical trust path

- Canonical endpoint: `POST /api/v1/attestation/verify`
- Canonical implementation: `worker-app/`
- Shared decision contract: `packages/verifier/`
- Reference/offline verification: `protocol/`
- Positive verification: `decision=verified` and `valid=true`
- Decision vocabulary: `verified`, `warning`, `blocked`, `revoked`, `expired`, `not_found`, `risk`, `indeterminate`

**Rule:** resolution is not verification. QR, registry, NFT, blockchain, DPP and agent surfaces consume the canonical response; they do not create a second trust authority.

## Architecture

- [NETWORK.md](NETWORK.md) — production topology
- [CAPABILITIES.md](CAPABILITIES.md) — capability catalog
- [DEPLOY-RUNBOOK.md](DEPLOY-RUNBOOK.md) — deployment paths and secrets
- [architecture/THIN_COMMERCIAL_SURFACES.md](architecture/THIN_COMMERCIAL_SURFACES.md) — vertical surfaces over shared verification
- `architecture/` — ADRs, threat model, robustness and configuration standards
- `config/cloudflare-estate.json` — Worker source/identity/deployment inventory

## Operations

- `operations/` — launch, pilot, Cloudflare-first, Stripe and operational runbooks
- [operations/CLOUDFLARE_FIRST_BASELINE.md](operations/CLOUDFLARE_FIRST_BASELINE.md) — Cloudflare deployment authority and smoke/repair loop
- [operations/PILOT-READY-BASELINE.md](operations/PILOT-READY-BASELINE.md) — first real-product pilot gate
- `superpowers/plans/` — generated inventories and implementation plans

## Strategy

- [strategy/NORTH_STAR_MVPS.md](strategy/NORTH_STAR_MVPS.md) — protocol-first MVP sequence
- `strategy/` — roadmap, revenue, system state, competitive research and proposals
- [strategy/SYSTEM_STATE.md](strategy/SYSTEM_STATE.md) — AgentZ state snapshot

## Product surfaces

- `apps/` — product applications, including QRON
- `src/` / `client/` — web/customer surfaces
- `workers/` — Cloudflare edge integrations
- `agentz/` — operational agent runtime
- `mcp/` — machine-facing interface
- `protocol/` — open verification reference

## Compliance, API and reference

- `compliance/` — DPP and compliance material
- [openapi.yaml](openapi.yaml) — API specification
- `knowledge/` — product, reliability and verification guidance
- `archive/` — historical bundles and session artifacts
- `submissions/` — proposal/grant drafts

## Documentation hygiene

1. Put current architecture and public truth in the canonical paths above.
2. Keep historical documents when they preserve provenance, but label them as historical when necessary.
3. Do not advertise an unvalidated commit as production.
4. Do not use a deployment, registry row, QR match, signature or blockchain anchor as a substitute for the canonical verification decision.
5. When a document becomes stale, point it to the canonical source rather than creating another competing map.

## AgentZ

`agentz/` is a separate operational tree, not an alternate verification authority.

```bash
python -m agentz.cli list
python -m agentz.cli run authichain_pilot_deploy --mode dry-run
```

## Known documentation debt

- The repository contains a large historical/experimental documentation estate; the index intentionally exposes canonical paths first.
- A legacy reference to `docs/SECURITY-REMEDIATION-CRITICAL.md` has existed without that file being present; do not recreate it merely to satisfy a stale link without validating the intended replacement.
