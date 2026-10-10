# AuthiChain North-Star MVPs

**Status:** execution charter  
**Branch:** `feat/north-star-mvps`  
**Baseline:** `main` @ `7ba4d834ed78564e90eca9f2625965f4ea51a103`  
**Principle:** one trust protocol, multiple revenue surfaces.

## North Star

Turn one physical product/unit into a durable, independently verifiable digital identity and make the complete path commercially usable:

`identify → resolve → attest → verify → interpret → act → pay → retain`

The MVP program is not a collection of disconnected demos. Every surface must consume the same AuthiChain verification primitives and produce evidence that can be inspected by a human, API client, or agent.

## Product hierarchy

### MVP-0 — Verification Core

**User:** anyone verifying a product or asset.

**Outcome:** a stable identifier resolves to an evidence-backed verification result.

**Must ship:**
- identifier normalization and resolution;
- signed attestation verification;
- issuer/JWKS validation;
- status/revocation evaluation;
- policy evaluation;
- evidence and provenance response;
- explicit distinction between `verified`, `not_found`, `revoked`, `expired`, and `risk/indeterminate`;
- public `/verify` experience;
- machine-readable API response;
- conformance fixtures and negative tests.

**Acceptance:** a known-good fixture verifies; invalid signature, unknown issuer, revoked/expired status, malformed identifier, and absent identifier fail with deterministic results; no result claims that registration alone proves physical quality or non-counterfeit status.

### MVP-1 — Paid Digital Product Passport

**User:** a manufacturer/brand onboarding a first real product family.

**Outcome:** merchant can purchase, provision, issue and verify a DPP-backed product identity without founder intervention after initial configuration.

**Must ship:**
- merchant onboarding;
- product/unit identifier creation/import;
- attestation issuance;
- hosted verification page;
- Stripe checkout;
- canonical Stripe webhook at `/api/stripe/webhook`;
- idempotent paid-session fulfillment;
- activation/provisioning record;
- funnel events: attributed → checkout_started → payment_succeeded → provisioned → verification → retained;
- operator audit trail;
- smoke buyer and real-product verification test.

**Acceptance:** a real paid checkout produces exactly one provisioned entitlement, the customer receives an activation path, the provisioned product verifies publicly, and replaying the webhook does not duplicate fulfillment.

### MVP-2 — QRON Verification Experience

**User:** brands and event/product operators that need a beautiful scan surface.

**Outcome:** a QRON code is a presentation layer over the same verification protocol.

**Must ship:**
- signed QR payload generation;
- QR creation/generation surface;
- scan → resolve → verify flow;
- mobile-first verification result;
- shareable verified result;
- scan event/audit record;
- risk signal presentation;
- no second trust registry.

**Acceptance:** a generated QR resolves to the same underlying object/attestation as direct identifier verification; tampering and stale/revoked states are visible; QR art never becomes the trust authority.

### MVP-3 — Regulated Provenance / StrainChain

**User:** regulated physical-goods operator.

**Outcome:** provenance claims, evidence and verification are bound to a specific product/unit rather than existing only as disconnected documents.

**Must ship:**
- lot/unit identity;
- evidence ingestion;
- provenance timeline;
- attestation/evidence linkage;
- verification result;
- exportable audit record;
- configurable policy checks.

**Acceptance:** an operator can trace one unit/lot from supplied evidence to a signed verification result and an independent verifier can reproduce the decision from the published evidence set.

### MVP-4 — GovChain Trust Workflow

**User:** government/contractor ecosystem participant.

**Outcome:** a contractor, vendor, document, or seal can carry an attributable verification state without turning the MVP into a general government ERP.

**Must ship:**
- organization identity;
- scoped claims/seals;
- signer/key status;
- verification page/API;
- evidence/audit trail;
- conservative status semantics;
- Base anchoring only where already supported and proven.

**Acceptance:** a verifier can identify issuer, claim scope, status and evidence; anchoring is an extension of the trust record, not the trust decision itself.

### MVP-5 — AgentZ / MCP Trust Interface

**User:** software agents and automation systems.

**Outcome:** agents can consume and act on the same verification primitives with explicit identity, capabilities, auditability and fail-closed behavior.

**Must ship:**
- agent identity/passport;
- signed agent messages;
- capability verification;
- `/api/v1/agents/verify` and passport flow;
- MCP access to verification/evidence operations;
- audit records;
- policy-gated actions;
- dry-run default for economic/outbound actions;
- idempotency/replay protection.

**Acceptance:** an authorized agent can verify an attestation and propose an action; unauthorized, expired, replayed, or policy-disallowed actions are rejected; no autonomous spend or outbound communication is enabled merely by deployment.

## Shared architecture rules

1. **Protocol first.** Vertical surfaces call the canonical verification layer; they do not fork identity, attestation, status, or policy semantics.
2. **Cloudflare-first.** Production edge work targets the existing Cloudflare Workers architecture.
3. **Evidence over claims.** Every milestone needs executable tests, fixtures, deployment evidence, or real transaction/scan evidence.
4. **Fail closed.** Secrets, payments, outbound messaging, minting and agent actions require explicit authorization and safe defaults.
5. **No invented infrastructure.** Do not invent gateway URLs, secrets, endpoints, contract addresses, customer data, or live credentials.
6. **No moonshot acceptance criteria.** Future ambitions may be documented as goals, never represented as shipped capability.
7. **One economic loop.** Optimize first for `attributed traffic → paid checkout → provisioning → activated merchant → verification → retention`.
8. **Founder-only operations.** Automate repeatable execution, but retain explicit owner gates for irreversible financial, credential, deployment, and outbound actions.

## Delivery order

`MVP-0 → MVP-1 → MVP-2 → MVP-3/MVP-4 → MVP-5`

Do not start a vertical implementation when it requires a missing protocol primitive. Close the primitive first, then reuse it across surfaces.

## Definition of Done for the North Star

The program is North-Star complete when one real product can be:

1. identified;
2. issued a signed attestation;
3. resolved through a standard identifier;
4. independently verified;
5. presented through QRON;
6. purchased/provisioned through the paid DPP path;
7. represented with evidence/provenance;
8. consumed through API/MCP by an authorized agent;
9. audited end-to-end;
10. replay-tested and fail-closed at every security/economic boundary.

## Required validation gate

Every MVP follows:

`inspect existing implementation → identify concrete gap → implement smallest complete slice → unit/integration/contract tests → typecheck → lint → production build → deployment smoke test → real-path verification → document evidence`

The **Contract tests (Hardhat)** result remains a release gate where blockchain contracts are touched.

## Out of scope for MVP completion

- speculative multi-agent consensus claims;
- unsupported regulatory certification claims;
- blockchain-first trust semantics;
- autonomous uncontrolled spending;
- autonomous cold outreach without owner authorization;
- large-scale infrastructure spend before revenue;
- duplicating the trust registry per vertical.
