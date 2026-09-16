# QFS-ready layer (ISO 20022 + PQC slot)

There is **no public Quantum Financial System** to integrate with. No API, no SWIFT
successor, no gold-backed settlement node that AuthiChain (or anyone) can
authenticate against. Claims otherwise are marketing, not infrastructure.

This directory is the honest integration:

| Layer | What ships | What does not |
|---|---|---|
| Carriage | ISO 20022 `pacs.008.001.08` JSON wrapping a provenance VC in `SplmtryData` | A live credit transfer |
| Integrity | Dual digest SHA-256 + SHA-512 over the signed record | A fabricated quantum ledger |
| Signature | Existing Ed25519 (SPEC v0.1) | Production ML-DSA-65 (slot reserved, FIPS 204) |
| Verify | Offline, zero network, same as `protocol/verifier.mjs` | A "QFS node" round-trip |

## Use

```bash
node protocol/qfs/envelope.mjs record.json
node --test protocol/qfs/envelope.test.mjs
```

```js
import { toPacs008, verifyEnvelope } from './envelope.mjs';
const envelope = toPacs008(record);
const { ok, status } = verifyEnvelope(envelope, anchor); // anchor optional
```

Banks that already ingest ISO 20022 can treat the AuthiChain record as structured
remittance. When a FIPS-validated ML-DSA-65 implementation is wired into
`protocol/attestation`, `digest.pqcStatus` flips from `reserved` to `bound` and
the envelope shape does not change.

Do not put `*.vercel.app` or Access-gated URLs in `CdtrAgt`. Production verify
path is `https://authichain.com/verify` once Cloudflare Access is lifted
(see `docs/operations/PUBLIC_LOOP_FREEZE.md`).
