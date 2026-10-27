# Verification evidence: dogfood baseline

Date: 2026-10-22. Repository commit: `caf0f083` (`main`). Verifier: `protocol/verifier.mjs` (`verifyRecord`).

## What was run

1. `node scripts/generate-dogfood.mjs`. It creates an ephemeral Ed25519 keypair, signs a reference provenance record
   (type `VerifiableCredential` / `ProvenanceRecord`, `Ed25519Signature2020`, `assertionMethod`), and verifies it with the
   repository's own verifier. Output file: `docs/execution/AUTHICHAIN_DOGFOOD_RECORD.json` (generated; not committed).
2. A negative-case script (kept in the session scratchpad, not in the repo) that mutates that record and re-verifies it.

## Results

| Case | Verdict | Reason codes |
| ---- | ------- | ------------ |
| Untouched record | `valid-unanchored` | none; `checks.signature = true` |
| Tampered subject name | `invalid` | `signature_invalid` |
| `proofValue` truncated | `invalid` | `signature_invalid` |
| `proofValue` removed | `invalid` | `signature_unverifiable:proofValue must be base58btc (z-prefixed)` |
| Wrong issuer DID | `invalid` | `signature_invalid` |
| Malformed payload (a string) | `invalid` | `missing_field:@context`, `type`, `issuer`, `validFrom`, `proof`, `credentialSubject.id` |
| Missing proof | `invalid` | `missing_field:proof` |

Reason codes are stable and specific. No case returns "counterfeit": a failed check is reported as invalid or unverifiable,
not as a statement about the physical object.

## Reproduce

```
pnpm install --frozen-lockfile
node scripts/generate-dogfood.mjs
```

Then call `verifyRecord(record, null, { now })` from `protocol/verifier.mjs` on the `record` field, with each mutation above.

## Limitations (read these before quoting the result)

- `valid-unanchored` means the signature checks out against the key in the issuer DID. It does **not** mean the record is
  anchored, independently confirmed, or true.
- The key is ephemeral and generated in the same process as the signature. This shows the verifier accepts a well-formed
  signed record and rejects tampering. It is an internal self-test, not an external audit or certification.
- The signed subject is a static "AuthiChain Reference Demonstration" product (GTIN-style identifier), **not a release**.
  It is not bound to a git commit, build artifact digest, version or pipeline. The brief's dogfooding goal (attest a release
  and verify it) is therefore only partly met. Binding it to `CI_COMMIT_SHA` and an artifact SHA-256 is NEXT_ACTIONS N-3.
- Replay, expiry and revocation behaviour are covered by `protocol/adversarial/` fixtures and the protocol test suite
  (passing in the baseline), not by this run.
