# AuthiChain Unified

**The canonical source for AuthiChain's physical-world trust protocol.**

AuthiChain gives physical products and assets a verifiable digital identity: an identifier resolves to a representation, an issuer signs claims, the verifier evaluates cryptography, issuer trust, lifecycle state and evidence, and consumers receive a deterministic decision.

> **Production source of truth:** `undone0603/authichain-unified`.
>
> **Validation rule:** the repository can contain candidates, previews and historical material. Do not call a commit or release production-validated until the exact commit passes the required gates.

## North Star

```text
identify → resolve → attest → verify → interpret → act → pay → retain
```

One trust protocol powers multiple surfaces:

- **AuthiChain** — verification, attestations, product identity, API and billing
- **QRON** — programmable verification presentation and QR experiences
- **GovChain** — evidence-backed government/contractor workflows
- **StrainChain** — provenance and regulated-product workflows
- **AgentZ / MCP** — machine-facing consumption of the same verification result

The vertical products are consumers of the trust layer, not alternate verification authorities.

## Canonical verification

**Trust boundary:** `POST /api/v1/attestation/verify`

Resolution is not verification. A resolver tells us what identifier or resource is being addressed. Verification evaluates whether a signed claim is valid, attributable, current and consistent with the evidence available to the verifier.

The canonical response uses a deterministic decision vocabulary:

`verified | warning | blocked | revoked | expired | not_found | risk | indeterminate`

Only **`decision=verified` AND `valid=true`** is positive protocol verification.

A QR match, registry row, NFT, blockchain anchor, DPP publication or valid signature cannot independently manufacture `verified=true`. A missing identifier is not by itself proof of counterfeiting; a registered identifier is not by itself proof of manufacturing quality or physical inspection.

## Architecture

```text
                         PHYSICAL WORLD
                               │
                        product / asset / unit
                               │
                               ▼
                       identifier / GS1 link
                               │
                               ▼
                        ┌───────────────┐
                        │   RESOLVE     │
                        │ representation│
                        └───────┬───────┘
                                │
                                ▼
                 ┌────────────────────────────┐
                 │     CANONICAL VERIFY       │
                 │ /api/v1/attestation/verify│
                 │                            │
                 │ JWS + issuer/JWKS          │
                 │ lifecycle / revocation     │
                 │ provenance / policy        │
                 │ risk signals                │
                 └──────────────┬─────────────┘
                                │
                       VerificationDecision
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
          Humans             AgentZ/MCP         Products
          /verify               /API          DPP · QRON
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
                    GovChain · StrainChain
                                │
                                ▼
                     billing / audit / retention
```

## Repository map

| Area | Location | Role |
|---|---|---|
| Canonical verifier | `worker-app/` | Cloudflare Worker implementation of the canonical verification response |
| Verification primitives | `packages/verifier/`, `protocol/` | Decision contract, canonicalization, signatures and reference verification |
| Product surfaces | `src/`, `apps/`, `client/` | DPP, QRON and vertical customer experiences |
| Edge integrations | `workers/` | Cloudflare Workers and integrations with declared estate ownership |
| Agent operations | `agentz/` | AgentZ workflows, gates and operational adapters |
| Machine interface | `mcp/` | MCP access to AuthiChain capabilities |
| Persistence | Supabase/Postgres + D1 | Operational state, attestations, events and application data |
| Deployment inventory | `config/cloudflare-estate.json`, `docs/ESTATE.md`, `docs/NETWORK.md` | Source, identity and deployment topology |
| Strategy | `docs/strategy/` | North-Star product/protocol strategy and MVP sequencing |

Start here:

1. `README.md` — public architecture and trust boundary
2. `docs/INDEX.md` — documentation index
3. `docs/ESTATE.md` — canonical source and deployment ownership
4. `docs/NETWORK.md` — production topology
5. `docs/strategy/NORTH_STAR_MVPS.md` — current MVP sequence

Historical or experimental material may remain for provenance, but it should not be treated as a competing production source.

## Product surfaces

- **authichain.com** — protocol, verification, certificates, API and billing
- **qron.space** — QRON creation and verification presentation
- **govchain.us** — government/contractor trust workflows
- **strainchain.io** — provenance and regulated-product workflows

These are presentation/commercial surfaces over the same underlying trust model.

## Standards flow

1. **Identify** — represent a unit with a stable identifier; where applicable use GS1 Digital Link such as `/01/{gtin}/21/{serial}`.
2. **Resolve** — resolve the identifier to the appropriate representation or linkset.
3. **Attest** — an issuer signs claims about the identified object.
4. **Verify** — check the signature, issuer trust, lifecycle/revocation and applicable policy.
5. **Interpret** — return the evidence-backed decision and risk signals.
6. **Act** — humans, agents and enterprise systems consume the canonical response.
7. **Pay / retain** — commercial flows measure attribution, checkout, provisioning and retention without changing the trust result.

## Deployment model

**Cloudflare-first.** Cloudflare Workers/Wrangler are the production edge. Legacy framework code may remain for compatibility or migration, but it is not the architectural center of gravity.

- Edge/runtime: Cloudflare Workers + Wrangler
- Web: Vite + React, with legacy Next.js surfaces where still required
- Data: Supabase/Postgres + Cloudflare D1
- ORM: Drizzle
- Package manager: pnpm
- Agent runtime: Python / AgentZ
- Protocol/API: TypeScript, Hono and standard cryptographic libraries

## Validation and release discipline

The intended readiness sequence is:

`install → typecheck → lint → tests → production build → security checks → deployment smoke test → real product scan`

For contract-related work, **Contract tests (Hardhat)** are the decisive contract gate.

Use these labels precisely:

- **Validated** — required gates passed for the exact commit/tag.
- **Candidate** — intended for validation; not released.
- **Preview / experimental** — exploratory; not a production guarantee.
- **Historical** — retained for provenance or migration.
- **Goal** — intended future capability, not current evidence.

A deployment proves that a bundle was published; it does not by itself prove protocol, regulatory, security or commercial claims.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Never put credentials in source code. Use local environment variables or deployment secret stores.

For AgentZ:

```bash
python -m agentz.cli list
python -m agentz.cli run authichain_pilot_deploy --mode dry-run
```

## Security

- No credentials in Git.
- Rotate any credential that has ever been committed until the provider confirms revocation/rotation.
- Keep secret scanning and fail-closed checks enabled.
- Prefer narrowly scoped credentials and service bindings.
- Do not use a green deployment as evidence for claims it did not test.

## License

See `docs/project/LICENSE.md`.
