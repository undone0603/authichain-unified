# AuthiChain Trust Assertions v0.2 — non-blocking rollout initiative

**Status:** proposed, source-only. No production policy, signing key, payment rail, entitlement, issuer registration, database schema or release requirement changes in this PR.

## North star

Cryptographically verify *who signed what*, then independently evaluate whether the signer was trusted, the claim is live, the action was authorized, and the asserted outcome is supported by independent authoritative evidence. Neither an authentic signature nor a durable event alone establishes physical authenticity, commercial settlement or entitlement delivery.

**Critical sequencing:** The first settled, independently attributable, fulfilled **non-founder $299 DPP Readiness purchase** remains the P0 release target. Trust Assertions v0.2 is explicitly **not** a required check, mandatory migration, new release gate, or reason to postpone P0. This initiative must not alter `ae/rule18-gate`, `humanHold`, `production_send=false`, payment integrity checks or protected deployments.

## Baseline / dependencies

- Existing compact JWS Ed25519 product attestation and issuer JWKS: `docs/attestation/v0.1.md` and `packages/verifier/src/index.ts`.
- Existing lifecycle/issuer trust: `docs/attestation/durable-status.md`, `docs/attestation/trust-registry.md`, `worker-app/attestation-registry.ts`. Verify signature, issuer status, durable lifecycle and policy independently. If revocation storage cannot be read, fail closed rather than treating unknown as active.
- Current AgentZ read-only chat identity boundary: proposed `feat/agentz-managed-oauth-chat-20261112`. The separate remote MCP client guide is [PR #2473](https://github.com/undone0603/authichain-unified/pull/2473). Both are **unmerged candidates**, not production evidence.
- DPP paid proof: [PR #2411](https://github.com/undone0603/authichain-unified/pull/2411) remains independently gated. Its source and tests are **not** in main. Do not merge it from here, import untested code, or claim a paid transaction was proven.
- Stripe is authoritative for checkout, payment intent, settlement and reversal; Supabase/D1 entitlement persistence is authoritative for grant/usage; actual buyer/customer delivery records are authoritative for fulfillment. Attestation wrappers are **receipts of checked facts**, not replacements for those checks.

## Trust assertion vocabulary

Every asserted fact has:
- **issuer identity** and signing key `kid`, with registered trust and permitted purpose;
- **subject** and canonical reference, without raw secrets, wallet keys or PII in public metadata;
- **audience** and exact intended relying service;
- **schema/version** and algorithm allowlist (avoid key confusion; don't accept a token-chosen JWKS URI);
- **issued/expiry** time, unique `jti` and optional request-bound nonce;
- **scope/policy** and optional delegation chain, with explicit payment authorization separate from identity;
- **evidence refs** and their digests (not assertions that non-existent evidence is complete);
- **revocation/status** checked against durable live status when a claim is acted upon;
- **verification result**, including each independently evaluated gate and source freshness.

Five distinct claims and their authoritative systems:

| Claim type | Trust predicate | What a signature cannot prove |
|---|---|---|
| `agent.identity` | issuer trust + valid key + identity binding | permission to operate, spend or deploy |
| `agent.delegation` | identity + audience + scope + policy + not revoked + replay guard | outcome or delegated rights not present in policy |
| `product.provenance` | issued JWS + subject mapping + issuer/status + evidence continuity | physical authenticity of a copied QR/label |
| `commerce.payment` | Stripe server-side expanded line items, correct SKU/qty/currency, real nonzero payment, settlement/reversal check | durable entitlement or buyer independence |
| `commerce.fulfillment` | correlated paid session + idempotent persisted grant + usability + real activation/delivery evidence | payment merely because a funnel event says 'succeeded' |

**Never** replace `payment_intent` and verified Stripe financial state with `payment_status=paid` when `amount_total=0` and no PaymentIntent. A founder, household, free, promotional, test or replayed session must never be counted toward the real $299 first-customer KPI.

## Execution phases (strictly ordered within this initiative, never before P0)

### Phase A — harden existing AgentZ identity and authorization assertions

- Verify cryptographic signature, exact trusted issuer, `aud`, permitted alg/`kid`, `nbf`/`iat`/`exp`, identity and bounded lifetime; reject unsigned, untrusted issuer, wrong-audience and kid-swap inputs.
- For OAuth client authorization, keep chat read-only, machine token private, and protected task scheduling separate. Test both direct Worker URL spoofed identity headers and Access proxy forwarding. Token confidentiality is not token validation.
- For future Agent Passport delegation, sign exact scope, budget, `payment_authorized`, action target, expiration, unique `jti`, non-redelegation defaults. Bind high-consequence requests to method/path/body digest and a single-use nonce or idempotency record.
- Acceptance: original native unit/integration logs on exact head and effective authorization negative matrix. No new live tools or general browser/CI permissions in Phase A.

### Phase B — harden paid checkout and fulfillment evidence

- Keep PR #2411's strict Stripe-derived paid-product eligibility and fail-closed webhook behavior as the separate P0 change; run its native tests, legitimate protected merge and both runtime releases when ready. Do **not** require v0.2 code for that release.
- After a real independently authorized purchase, reconcile session ID to PaymentIntent/settled amount/currency/price/qty, durable grant, exact-once replay behavior, activation email or actual delivery, usage, and payer independence.
- Emit non-authorizing, privately held `commerce.payment` and `commerce.fulfillment` receipts **after** verifying the underlying authoritative facts. Store pseudonymous refs and hashes, not customer email, payment credentials or full Stripe payloads in public records.
- Negative tests: forged/missing signature, wrong price, zero amount, no PaymentIntent, unpaid, recurring, expired, partial expanded line items, grant failure, replay, refund/dispute, wrong customer, absent activation, stale read or unavailable persistence.
- Acceptance: no grant on invalid claims and no false paid-buyer metrics; live proof requires the **same** real session across systems, not aggregate counts.

### Phase C — portable product and supplier credentials (follow-on, optional)

- Build optional adapters for W3C VC Data Model 2.0 and JOSE/COSE secured credentials; preserve v0.1 JWS and existing verification endpoints for compatibility.
- Use issuer-specific keys and credential status/revocation lists, subject identifiers (GTIN+serial/lot), digest-linked supplier evidence and privacy-safe disclosure. Keep QRON verification distinct from physical inspection.
- Evaluate OpenID4VCI/OpenID4VP and selective-disclosure support after Phase A/B evidence and security review; version exchange formats and pin the exact profile revision.
- Require independent supplier verification, claims authority review and privacy/consent before production issuance. Portable credentials are not certifications by default.

## Independent evidence checklist

| Evidence | Must capture |
|---|---|
| Provenance | repository commit SHA, original test job URL/logs, container isolation |
| Signed assertion | protected header, exact algorithm/kid, audience, issuer, expiry, key registry version |
| Live status | status source, read timestamp, revocation result or explicit unknown |
| Delegation | principal, scopes, operation digest, replay result, budget, policy decision |
| Payment | authoritative Stripe session+intent, product/price/qty, amount received, reversal state |
| Grant | durable idempotency record, entitlement count/limit, replay result |
| Delivery | delivered/activated state from customer-facing system, not just queued email |
| Buyer qualification | verifiable non-founder attribution with privacy safeguards |

No single signed receipt is a substitute for the other rows.

## Release guardrail

This PR is a **non-blocking design/fixture** track. The separate P0 DPP release may proceed as soon as its own enforced tests, approvals, protected releases and payment-fulfillment evidence exist. Never add this initiative as a mandatory merge or deployment dependency. No new production keys, DNS, auth bypass, database migration, external outreach or spend are authorized.
