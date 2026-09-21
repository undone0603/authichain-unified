# Thin commercial surfaces

Verification is AuthiChain infrastructure. Brand sites are acquisition surfaces.

## Shared (do not fork)

- Attestation verify: `packages/verifier`
- DPP verify: `src/lib/dpp-verify.ts` (mounted on Next and worker-app)
- JWKS / issuer: `/protocol/jwks.json`, `/protocol/issuer.json`
- Funnel + DPP loop: `src/lib/funnel-record.ts`, `src/lib/dpp-loop.ts`
- Plans that charge: `src/lib/plans.ts`

## Brand-owned

| Surface     | Owns                                       | Must not own                                  |
| ----------- | ------------------------------------------ | --------------------------------------------- |
| QRON        | generate UX, credits, storymode            | cryptographic verify                          |
| GovChain    | onboard, opportunities, grant copy         | a second attestation verifier                 |
| StrainChain | genetics passport display, METRC messaging | a second DPP verify                           |
| Nightstamp  | scan-gate UX                               | JWKS issuance                                 |
| Storepilot  | merchant billing UX                        | Stripe webhook truth (shared `stripe_events`) |

`scripts/guard-thin-surfaces.mjs` fails CI if a brand worker copies a private Ed25519 verify or a second JWKS issuer.
