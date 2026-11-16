# ARQANT ↔ AuthiChain: offline subject-binding negative fixture

A [voluntary public ARQANT maintainer reply](https://github.com/undone0603/authichain-unified/issues/2263#issuecomment-6889818200) requested a tiny read-only pair that distinguishes a known-good subject from a synthetically valid signature bound to the wrong subject/digest. This is a response to an **expressed peer inquiry**, not a partnership or independently passing integration.

Run locally with Node.js 22 or later:

```sh
node --test scripts/alliances/peer-subject-binding-fixture.test.mjs
```

The pair is represented by the first three cases: a known-good synthetic subject/digest; a valid *declared* record signature with wrong subject; and a valid *declared* record signature with wrong digest. Seven additional boundary tests check unsigned records, unaccepted work, mismatched work subject, mismatched settlement digest, explicitly declared synthetic confirmation, invalid digest encoding, and missing objects.

The fixture uses **boolean declarations** such as `syntheticSignatureValid` and `syntheticIndependentConfirmation` and **does not cryptographically verify signatures, query any chain, make HTTP requests, issue payment, or grant an entitlement**. Even when `PAYMENT_SETTLED=true` in the deliberately all-positive synthetic test, `externalPaidAdoptionCounted=false` remains hard-coded. Never map this synthetic flag to real revenue or verified settlement.

Four distinct predicates are `RECORD_INTEGRITY_VALID`, `SUBJECT_MATCHED`, `WORK_ACCEPTED`, `SETTLEMENT_CONFIRMED`. A signed record with the wrong subject/digest cannot produce `DELIVERY_VERIFIED`; a signed work receipt cannot alone produce `PAYMENT_SETTLED`. These are *local acceptance semantics*, not official A2A/MCP/x402 certification.

For a genuine reciprocal interoperability test, an independent, consenting ARQANT operator would need to pin the exact client SHA, submit redacted request/response and result hashes, and explicitly accept/reject this mapping. The independent [free MCP evidence guide](../agent-adoption/INDEPENDENT_REPRODUCTION.md) applies to MCP only; A2A task traces and x402 paid settlement require their own protocol-specific receipts. No external adopter or settlement is counted from this fixture.
