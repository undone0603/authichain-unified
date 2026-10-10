# QRON surface inside AuthiChain Unified

This directory is a **retained application surface inside the canonical `undone0603/authichain-unified` repository**. It is not a separate production source or an alternate trust protocol.

## Production architecture

QRON provides the presentation and interaction layer for beautiful, programmable verification experiences. The production trust result comes from the canonical AuthiChain verification path:

`identifier → resolve → signed attestation → /api/v1/attestation/verify → VerificationDecision`

A QR image, visual match, registry record, NFT/anchor, or DPP publication must never independently produce `verified=true`.

## Ecosystem surfaces

- **qron.space** — QRON creation and verification experiences.
- **authichain.com** — canonical protocol, verification, certificates, API and billing surface.
- **govchain.us** — government/contractor trust workflows.
- **strainchain.io** — provenance and regulated-product workflows.

These are branded surfaces over the same AuthiChain trust architecture. New production work belongs in the unified repository rather than the archived/superseded standalone `qron-platform` project.

## Tech stack

- Next.js where this retained surface requires it
- Cloudflare Workers at the production edge
- Drizzle ORM with PostgreSQL where applicable
- Shared AuthiChain verification contracts from `packages/verifier/`

## Verification integration

Consumers should call the canonical worker through the shared verification client and forward its response. The canonical response includes:

- `decision`
- `valid`
- `reasons`
- `decision_contract`
- issuer/lifecycle status and supporting fields

Only `decision=verified` **and** `valid=true` is a positive protocol verification.

## Development

From the repository root:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
```

Use the repository root's deployment workflows and Cloudflare estate map for production ownership. Do not create a second production deployment path for this directory.

## Security

- Never commit credentials or production secrets.
- Keep verification fail-closed when the canonical worker is unavailable.
- Do not present resolution, registration, anchoring, or QR aesthetics as proof of physical authenticity.
- Treat this directory as a consumer/presentation surface, not the protocol authority.
