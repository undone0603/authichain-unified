# AuthiChain Unified

**The canonical implementation of AuthiChain's physical-world trust layer.**

AuthiChain turns a physical product or asset into a verifiable digital identity: a standards-aware identifier resolves to a signed claim, policy and provenance data are evaluated, and an independent verifier returns an auditable result.

This repository is the canonical build/deploy surface for:

- **AuthiChain** — verification, attestations, product identity, API and billing
- **QRON** — beautiful, programmable verification experiences and QR studio
- **GovChain** — government/contractor trust workflows and seals
- **StrainChain** — provenance and product verification for regulated physical goods
- **AgentZ / MCP** — agentic orchestration and machine-facing access to the same trust primitives

> **Core thesis:** one verification protocol, many commercial surfaces. The vertical products should not fork the trust model.

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
                  ┌───────────────┐
                  │   RESOLUTION  │
                  │ identifier →  │
                  │ representation│
                  └───────┬───────┘
                          │
                          ▼
              ┌──────────────────────┐
              │ AUTHICHAIN VERIFY    │
              │ signed claims        │
              │ issuer / JWKS         │
              │ status / revocation   │
              │ provenance / policy   │
              │ scan-risk signals     │
              └──────────┬──────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           Humans      Agents     Enterprise
           /verify     MCP/API    integrations
              │          │          │
              └──────────┼──────────┘
                         ▼
              QRON · GovChain · StrainChain
                         │
                         ▼
                billing / onboarding /
                audit / operational data
```

### Trust boundary

**Resolution is not verification.** A resolver answers *what identifier/resource is being addressed*. AuthiChain verification evaluates *whether a signed claim is valid, current, attributable and consistent with the evidence available to the verifier*.

A positive status is therefore scoped to the evidence and policy being evaluated. For example, a registered product identifier does not by itself prove manufacturing quality, and a missing identifier is not by itself proof of counterfeiting.

## Repository map

| Layer | Location | Responsibility |
|---|---|---|
| Web / customer surfaces | `client/`, `workers/` | QRON and vertical user experiences at the public domains |
| Verification protocol | `protocol/` | Open-source protocol/reference implementation |
| Agentic operations | `agentz/` | Workflow orchestration, pilots, operational automation |
| Machine interface | `mcp/` | MCP access to AuthiChain capabilities |
| Edge/API | `workers/*` | Cloudflare Workers, routing, verification and integrations |
| Persistence | Supabase/Postgres + D1 | Operational state, attestations, events and application data |
| Architecture docs | `docs/ESTATE.md`, `docs/NETWORK.md` | System inventory and deployment topology |

## Public surfaces

- **authichain.com** — protocol, verification, certificates, API and billing
- **qron.space** — QRON creation and programmable experiences
- **govchain.us** — government/contractor trust workflows
- **strainchain.io** — provenance and product verification workflows

The domains are commercial and presentation surfaces over the same underlying trust architecture. The canonical customer paths are `/onboard`, `/dapp`, and `/verify`.

## Standards and verification flow

1. **Identify** — a physical unit is represented with a stable identifier; where applicable, use GS1 Digital Link syntax such as `/01/{gtin}/21/{serial}`.
2. **Resolve** — the identifier resolves to the appropriate representation or linkset.
3. **Attest** — an issuer signs claims about the identified object.
4. **Verify** — the verifier checks signatures, issuer keys, status/revocation and applicable policy.
5. **Interpret** — the system reports the evidence-backed state and any risk signals without conflating registration with physical inspection.
6. **Act** — humans, agents or enterprise systems consume the result through web, API or MCP interfaces.

## Deployment model

**Cloudflare-first.** The production edge is Cloudflare Workers and the repository's worker deployment configuration. Legacy framework code may remain in the repository where it supports compatibility or migration, but it is not the architectural center of gravity.

- Edge/runtime: Cloudflare Workers + Wrangler
- Web: Vite + React
- Data: Supabase/Postgres and Cloudflare D1
- ORM: Drizzle
- Package manager: pnpm
- Agent runtime: Python / AgentZ
- Protocol/API components: TypeScript, Hono and standard cryptographic libraries

See `docs/NETWORK.md` for deployment topology and `docs/ESTATE.md` for the system inventory.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev
```

For database-backed scripts, **never put credentials in source code**. Set `DATABASE_URL` in the local environment or the deployment secret store.

Example:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
```

## AgentZ

```bash
python -m agentz.cli list
python -m agentz.cli run authichain_pilot_deploy --mode dry-run
```

## Pilot readiness

The canonical readiness path is:

`install → typecheck → lint → tests → production build → deploy smoke test → real product scan`

See:

- `docs/operations/PILOT-READY-BASELINE.md`
- `docs/attestation/v0.1.md`
- `docs/ESTATE.md`
- `docs/NETWORK.md`

## Security

### Deploy invariant

A push to `main`, including a docs-only commit, runs `deploy-cloudflare.yml` and `deploy-edge-worker.yml`. Do not add `paths` or `paths-ignore`.

Secret scan (gitleaks 8.28.0, `--no-git`) runs first and must fail closed. Deploy permissions stay `contents: read`. No token values in Git.

A green Wrangler deploy means that commit's bundle was published. It is not a SOC 2, FedRAMP, FDA, government, or cannabis COA certificate. A verifier pass is the checks this checkout ran.

`authichain-consensus-engine` is an identity collision. Confirm it in Cloudflare before any retirement. This file does not retire it.

Security is part of the protocol presentation, not an afterthought.

- **No credentials in Git.** Runtime secrets belong in environment/deployment secret stores.
- **No live secrets in examples.** Use placeholders such as `sk_live_…`, `whsec_…`, or `postgresql://USER:PASSWORD@HOST/DB`.
- **Rotate exposed credentials immediately.** Removing a secret from the current tree does not invalidate a credential that may already exist in Git history, caches or logs.
- **Verify before release.** Run secret scanning before merging and keep the existing security checks enabled.
- **Least privilege.** Prefer narrowly scoped credentials and service bindings over broad account tokens.

If a credential has ever been committed, treat it as compromised until the provider confirms rotation/revocation.

## Project principle

AuthiChain is not fundamentally a blockchain UI. The durable product is the **verification layer**: standardized identity → resolution → signed attestation → independent verification → evidence-backed decision.

Blockchain anchoring, NFTs, QR art, AI agents and vertical applications can extend that layer; they should not redefine its trust boundary.

## License

See `docs/project/LICENSE.md`.
