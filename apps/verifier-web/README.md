# Verifier Reference Implementation: verify.authichain.com

## Purpose

An independent, framework-agnostic reference implementation of the AuthiChain Attestation Verifier.

## Principles

- **Zero-Trust:** This verifier MUST NOT rely on any backend database or API for verification decisions. It only relies on the public JWKS.
- **Protocol-First:** The UI is a pure rendering of the verification results defined by `@authichain/verifier`.
- **Adversarial Rigor:** The verifier MUST clearly display why a validation failed (e.g., tampering, key mismatch, expiration).

## Architecture

- **Tech Stack:** Simple Vite + React app (Minimal footprint).
- **Core Dependency:** `@authichain/verifier` (only).
- **Functionality:**
  - Input: JWS string.
  - Output:
    - Validation Status (Valid/Invalid).
    - Detailed Attestation Payload.
    - Cryptographic proof details (kid, alg).
    - Evidence Graph summary.

## Workflow

1.  Define the UI contract in this spec.
2.  Develop the UI as a standalone app in `apps/verifier-web`.
3.  Include a set of "adversarial" JWS fixtures to verify the UI correctly displays failure states.
