# OpenClaw Unified Architect: AuthiChain Governance

This file establishes the architectural mandate for the AuthiChain ecosystem. All future design and development must adhere to these principles to achieve industry leadership in verifiable trust.

## 1. Architectural Mandates

- **Independent Verifiability:** No service, API, or data structure is valid if it requires proprietary platform trust. All trust statements MUST be cryptographically verifiable via open standards (Ed25519/JWS).
- **Protocol-First Design:** Logic must be separated into framework-agnostic core libraries (e.g., `@authichain/verifier`). The application layer is a mere consumer of these protocols.
- **Adversarial Rigor:** Every protocol endpoint must include an automated conformance test suite, including negative tests for tampering, key mismatches, and malformed structures.
- **Deterministic Authority:** AI and human heuristics inform evidence, but final disposition must be enforced via a versioned, deterministic policy engine.

## 2. Structural Patterns

- **Packages:** `packages/` directory contains framework-agnostic libraries.
- **APIs:** API routes (`src/app/api/`) only handle transport/routing and input validation; they MUST NOT contain business logic.
- **Evidence Graph:** The evidence graph is the single source of truth for product state and trust history.

## 3. Development Workflow ("Drive to Green")

1.  **Plan:** Define protocol spec (e.g., `protocol/SPEC.md`).
2.  **Conformance:** Implement negative/positive test suite _before_ implementation.
3.  **Build:** Implement in `packages/`.
4.  **Enforce:** Run `npm run lint` and `npm test` continuously. No code is merged unless the environment is green.
5.  **Audit:** Every deployment is anchored by a verifiable attestation record.

## 4. Leadership Indicators

- Interoperability with EPCIS 2.0.
- Sub-100ms verification latency.
- Adoption of `@authichain/*` packages by third-party systems.
