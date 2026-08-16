# AuthiChain Verification Specification

**Version:** 0.1.0 (draft) · **Status:** proposed · **License:** Apache-2.0

This document specifies how a physical item's provenance is recorded, signed, and
**independently verified** — without trusting AuthiChain, and without contacting
any AuthiChain server.

That last property is the point. A verification service that must be asked
whether something is authentic has only moved the trust problem; it has not
solved it. Everything below is designed so a third party holding a record and a
public key can reach the same verdict offline.

## 0. Why this is open

A specification others are forbidden to implement is not a standard, and a
verifier nobody can run independently is not proof. Competitors are free to
implement this. What is not licensed here is the platform behind it — the
multi-agent scoring pipeline, the edge network, the operational tooling — or the
AuthiChain trademarks. See `../LICENSE.md`.

## 1. Terminology

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119.

- **Item** — a physical object with a unique identity.
- **Record** — a signed statement about an item at a point in time.
- **Anchor** — a commitment of a record's hash to a public ledger.
- **Issuer** — the entity whose key signs a record, normally the manufacturer.
- **Verifier** — any party checking a record. Needs no relationship with the issuer.

## 2. Alignment with existing standards

This specification does not invent a parallel vocabulary. Adoption follows
compatibility.

| Concern | Standard used |
|---|---|
| Record format | [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) |
| Signature suite | Ed25519 (RFC 8032) over JCS-canonicalised JSON (RFC 8785) |
| Item identity in URLs | [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link) |
| Hashing | SHA-256 (FIPS 180-4) |

A record is a Verifiable Credential. A conforming verifier for VC 2.0 with
Ed25519 support will validate the signature without knowing anything about this
document; Sections 4–6 add the anchoring rules on top.

## 3. Record structure

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://authichain.com/protocol/v1"
  ],
  "type": ["VerifiableCredential", "ProvenanceRecord"],
  "issuer": "did:key:z6Mk...",
  "validFrom": "2026-08-07T00:00:00Z",
  "credentialSubject": {
    "id": "https://id.gs1.org/01/09506000134352/21/SERIAL123",
    "gtin": "09506000134352",
    "serial": "SERIAL123",
    "batch": "B-2026-08",
    "events": [
      { "stage": "manufactured", "at": "2026-08-01T09:00:00Z", "location": "US-MI" }
    ]
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-08-07T00:00:00Z",
    "verificationMethod": "did:key:z6Mk...#z6Mk...",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-encoded-signature>"
  }
}
```

### 3.1 Required fields

`@context`, `type`, `issuer`, `validFrom`, `credentialSubject.id`, and `proof`
MUST all be present. A record missing any of them MUST be rejected — not
downgraded to a warning. Partial verification is the failure mode this whole
specification exists to prevent.

### 3.2 Canonicalisation

The signed payload is the record with `proof.proofValue` removed, canonicalised
per RFC 8785 (JCS), encoded UTF-8. Implementations MUST NOT sign a
pretty-printed or key-reordered form; two verifiers must derive byte-identical
input from the same record.

## 4. Anchoring

An anchor commits `SHA-256(canonical record bytes)` to a public ledger.

```json
{
  "recordHash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "chain": "polygon:137",
  "txHash": "0x...",
  "anchoredAt": "2026-08-07T00:05:00Z"
}
```

### 4.1 Rules

- `chain` MUST identify the network unambiguously, using
  [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) form (`polygon:137`,
  `eip155:1`, `bip122:000000000019d6...`).
- A verifier MUST treat a testnet anchor as **unanchored** unless the caller has
  explicitly opted into testnets. Presenting testnet anchors as production proof
  is the single most common way this class of system misleads people.
- `txHash` MUST be well formed for the named chain. A 64-hex-character value for
  an EVM chain; anything shorter or longer is malformed and MUST be rejected
  rather than displayed.
- Absence of an anchor is a valid state (`unanchored`), distinct from a **failed**
  anchor. A verifier MUST distinguish them and MUST NOT report either as verified.

## 5. Verification procedure

A conforming verifier, given a record and optionally an anchor, MUST:

1. Check required fields (§3.1). Reject on any absence.
2. Resolve the issuer's public key from `proof.verificationMethod`. For
   `did:key`, the key is embedded in the identifier — no network access required.
3. Canonicalise (§3.2) and verify the Ed25519 signature. Reject on mismatch.
4. Check `validFrom` is not in the future, and `validUntil`, if present, is not
   in the past.
5. If an anchor is supplied: recompute `SHA-256` of the canonical bytes and
   compare to `recordHash`. Reject on mismatch.
6. Apply §4.1 to the anchor's chain and transaction identifier.

Steps 1–4 require no network access. Confirming the transaction exists on-chain
(step 6's optional extension) does, and a verifier SHOULD report the difference
rather than conflating "signature valid" with "anchor confirmed".

### 5.1 Verdicts

A verifier MUST return exactly one of:

| Verdict | Meaning |
|---|---|
| `verified` | Signature valid; anchor present, well formed, on a mainnet chain, hash matches |
| `valid-unanchored` | Signature valid; no anchor supplied |
| `invalid` | Any required check failed |

There is deliberately no partial-credit verdict and no numeric score in this
layer. A score is a product feature; a verdict is what a verifier owes you.

## 6. Registry resolution

An item's records SHOULD be resolvable from its GS1 Digital Link URL. A registry
serving this specification MUST:

- Serve records at a permanent URL that does not change when the item changes hands.
- Serve them without authentication. Verification that requires an account is
  not public verification.
- Return `404` for unknown items rather than a synthesised or empty-but-successful
  record.

## 7. Conformance

An implementation conforms if it implements §5 completely and returns only the
§5.1 verdicts. `verifier.mjs` in this directory is the reference implementation;
it has no dependencies and can be run against any record by anyone.

## 8. Security considerations

- **Key compromise.** This specification does not define revocation. A record
  signed by a compromised key remains cryptographically valid. Revocation is
  planned for v0.2 via `credentialStatus`.
- **Garbage in.** A signature proves who asserted something, never that the
  assertion is true. An issuer can sign a false statement, and this layer will
  correctly report it as `verified`. Anything defending against that lives above
  this specification, not in it.
- **Anchor ≠ existence.** An anchor proves a hash was committed at a point in
  time. It does not prove the physical item exists or matches the record.
