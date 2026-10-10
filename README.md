# AuthiChain Unified

**The canonical implementation and production source for AuthiChain's physical-world trust layer.**

AuthiChain turns a physical product or asset into a verifiable digital identity: a standards-aware identifier resolves to a signed claim, policy and provenance data are evaluated, and the canonical verifier returns an auditable decision.

> **Production source of truth:** this repository, `undone0603/authichain-unified`. Do not pin customer traffic, production documentation, or new product work to a superseded sibling repository. Cloudflare Workers are the production edge; the canonical verification path is the worker implementation under `worker-app/`.

## North-Star MVP

The current product path is:

`identify → resolve → attest → verify → interpret → act → pay → retain`

The MVP sequence is deliberately protocol-first:

1. **Verification Core** — signed attestation, issuer/JWKS trust, lifecycle/revocation, deterministic fail-closed decision.
2. **Paid Digital Product Passport** — commercial DPP surface backed by the canonical verifier, not a parallel authenticity engine.
3. **QRON** — presentation/scan experience that carries the canonical verification response.
4. **StrainChain / regulated provenance** — unit/lot evidence and compliance-oriented workflows without treating registration as proof of quality.
5. **GovChain** — evidence-backed contractor/government trust workflows.
6. **AgentZ / MCP** — machine-facing consumption of the same verification result with explicit fail-closed authorization.

The durable product is the protocol. QRON, GovChain, StrainChain, DPP, and AgentZ are commercial/operational surfaces over it.

## Architecture at a glance

```text
                    PHYSICAL WORLD
                          │
                 product / asset / unit
                          │
                          ▼
                 GS1 Digital Link
              GTIN + serial / lot / qualifiers
                          │
                          ▼
                 ┌────────────────┐
                 │   RESOLUTION   │
                 │ identifier →   │
                 │ representation │
                 └───────┬────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ CANONICAL VERIFY     │
              │ /api/v1/attestation │
              │ /verify              │
              │ signed claim         │
              │ issuer / JWKS        │
              │ lifecycle / revocation│
              │ provenance / policy  │
              │ risk signals         │
              └──────────┬───────────┘
                         │
              actual VerificationDecision
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
        Humans         Agents       Enterprise
        /verify        AgentZ/MCP    DPP / API
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                QRON · GovChain · StrainChain
                         │
                         ▼
                 billing / onboarding /
                    audit / retention
```

## Canonical verification contract

**Resolution is not verification.** A resolver answers *what identifier/resource is being addressed*. AuthiChain verification evaluates *whether a signed claim is valid, current, attributable and consistent with the evidence available to the verifier*.

The canonical worker now resolves the public decision directly inside `verifyResponse()` after JWS verification, issuer trust evaluation, and durable lifecycle lookup. Its response includes:

- `decision`: `verified`, `warning`, `blocked`, `revoked`, `expired`, `not_found`, `risk`, or `indeterminate`
- `valid`: positive only when the decision is `verified` and all required checks pass
- `reasons`: deterministic explanation codes
- `decision_contract`: `AuthiChain Verification Decision v1`
- lifecycle and issuer status fields used to explain the result

Consumer surfaces must forward that actual response. They must not independently upgrade a QR match, registry row, blockchain anchor, DPP publication, or signature into `verified`.

A missing identifier is not by itself proof of counterfeiting. A registered identifier is not by itself proof of manufacturing quality or physical inspection.

## Repository map

| Layer | Location | Responsibility |
|---|---|---|
| Canonical verifier | `worker-app/` | Cloudflare Worker API and canonical attestation verification response |
| Verification primitives | `packages/verifier/`, `protocol/` | Decision contract, canonicalization, signatures and offline/reference verification |
| Product/customer surfaces | `src/`, `apps/`, `client/` | DPP, QRON and vertical experiences consuming canonical verification |
| Edge/API workers | `workers/` | Cloudflare Workers and integrations; each production Worker has one declared owner in the estate map |
| Agentic operations | `agentz/` | AgentZ workflows, launch gates and machine-facing operational adapters |
| MCP | `mcp/` | MCP access to AuthiChain capabilities |
| Persistence | Supabase/Postgres + D1 | Operational state, attestations, events and application data |
| Deployment inventory | `config/cloudflare-estate.json`, `docs/ESTATE.md`, `docs/NETWORK.md` | Canonical source/identity/deployment mapping |

## Production surfaces

- **authichain.com** — protocol, verification, certificates, API and billing
- **qron.space** — QRON creation and programmable verification experiences
- **govchain.us** — government/contractor trust workflows
- **strainchain.io** — provenance and regulated-product verification workflows

These are surfaces over the same trust architecture. New production work belongs in this repository rather than a superseded sibling repository.

## Standards and verification flow

1. **Identify** — represent a physical unit with a stable identifier; where applicable, use GS1 Digital Link such as `/01/{gtin}/21/{serial}`.
2. **Resolve** — resolve the identifier to the appropriate representation or linkset.
3. **Attest** — an issuer signs claims about the identified object.
4. **Verify** — check the signature, issuer trust, lifecycle/revocation and applicable policy.
5. **Interpret** — report the evidence-backed state and risk signals without conflating registration with physical inspection.
6. **Act** — humans, agents or enterprise systems consume the canonical response through web, API or MCP.
7. **Pay / retain** — commercial flows measure attributed traffic, checkout, provisioning and retention without changing the trust result.

## Deployment model

**Cloudflare-first.** The production edge is Cloudflare Workers and the repository's Wrangler/deployment configuration. Legacy framework code may remain for compatibility or migration, but it is not the architectural center of gravity.

- Edge/runtime: Cloudflare Workers + Wrangler
- Web: Vite + React, with legacy Next.js surfaces where still required
- Data: Supabase/Postgres and Cloudflare D1
- ORM: Drizzle
- Package manager: pnpm
- Agent runtime: Python / AgentZ
- Protocol/API: TypeScript, Hono and standard cryptographic libraries

See `docs/NETWORK.md` for topology and `docs/ESTATE.md` for the canonical source/identity map.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev
```

For database-backed scripts, **never put credentials in source code**. Set `DATABASE_URL` in the local environment or deployment secret store.

## Validation

The canonical readiness path is:

`install → typecheck → lint → tests → production build → deployment smoke test → real product scan`

For the current North-Star verification work, the route-level regression suite covers verified, warning, blocked, revoked, untrusted-issuer and bad-signature behavior.

## AgentZ

```bash
python -m agentz.cli list
python -m agentz.cli run authichain_pilot_deploy --mode dry-run
```

AgentZ is an operational consumer of the protocol. It must treat only the canonical response `decision=verified` with `valid=true` as positive verification.

## Security

- **No credentials in Git.** Runtime secrets belong in environment/deployment secret stores.
- **No live secrets in examples.** Use placeholders such as `sk_live_…`, `whsec_…`, or `postgresql://USER:PASSWORD@HOST/DB`.
- **Rotate exposed credentials immediately.** Removing a secret from the current tree does not invalidate a credential that may exist in history, caches or logs.
- **Verify before release.** Secret scanning, typecheck, lint and tests remain release gates.
- **Least privilege.** Prefer narrowly scoped credentials and service bindings over broad account tokens.
- **Fail closed.** A verification dependency failure must not be converted into a positive authenticity result.

A green deployment means that the tested commit's bundle was published. It is not a SOC 2, FedRAMP, FDA, government, cannabis COA, or physical-inspection certificate.

## Project principle

AuthiChain is not fundamentally a blockchain UI. The durable product is the **verification layer**: standardized identity → resolution → signed attestation → independent verification → evidence-backed decision.

Blockchain anchoring, NFTs, QR art, AI agents and vertical applications extend that layer; they do not redefine its trust boundary.

## License

See `docs/project/LICENSE.md`.
