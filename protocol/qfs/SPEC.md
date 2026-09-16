# AuthiChain QFS-ready profile v1

**Status:** implemented (carriage + verify). **Not** a claim of membership in any
external “quantum financial system.”

## 1. Purpose

Carry a SPEC v0.1 provenance record inside an ISO 20022
`pacs.008.001.08` document so a bank, ISO 20022 gateway, or future PQC-aware
settlement rail can treat authenticity as structured remittance.

## 2. Mapping

| ISO 20022 | Source |
|---|---|
| `GrpHdr.MsgId` | `AC-` + first 16 hex of SHA-256(signing bytes) |
| `PmtId.EndToEndId` | `credentialSubject.serial` else GTIN else MsgId |
| `PmtId.UETR` | UUID derived from SHA-256 (gpi-shaped, not SWIFT-issued) |
| `Dbtr.Id` | record `issuer` DID |
| `Cdtr.Id` | GS1 Digital Link |
| `IntrBkSttlmAmt` | default `0 USD` (attestation, not a wire) |
| `SplmtryData.Envlp.AuthiChain.record` | full Verifiable Credential |
| `SplmtryData.Envlp.AuthiChain.digest` | `{sha256, sha512, pqcAlg: ML-DSA-65, pqcStatus}` |

## 3. Verification

A conforming verifier MUST:

1. Require `profile === "authichain-qfs-iso20022-v1"`.
2. Extract the inner record and run SPEC v0.1 `verifyRecord`.
3. Recompute dual digest; mismatch is `invalid`.
4. If `PmtId.UETR` is present, it MUST match the SHA-256-derived UUID.
5. MUST NOT contact AuthiChain, SWIFT, or any purported QFS host to reach a verdict.

## 4. PQC transition

`pqcStatus: reserved` means the envelope is shaped for NIST FIPS 204 ML-DSA-65
but the production signature remains Ed25519. Binding a real ML-DSA signature
MUST set `pqcStatus: bound` and add `pqcProof` next to `record.proof`. Until
then, advertising this module as “on the QFS” is false.
