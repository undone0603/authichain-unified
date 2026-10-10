# AuthiChain Protocol

This directory contains the offline/open reference implementation of the AuthiChain verification protocol. It is part of the canonical `undone0603/authichain-unified` repository.

## Trust boundary

The offline verifier proves the checks represented by the protocol record and optional anchor. It does **not** replace the live canonical worker's issuer registry, durable lifecycle state, policy evaluation, or physical inspection.

For live product verification, the canonical API is:

`POST /api/v1/attestation/verify`

Its response is the shared `AuthiChain Verification Decision v1` contract. Only `decision=verified` with `valid=true` is a positive protocol verification.

## Install

```bash
npm install authichain-verify
npx authichain-verify node_modules/authichain-verify/examples/record.json
node -e "import('authichain-verify').then(({verifyRecord})=>console.log(verifyRecord(require('./node_modules/authichain-verify/examples/record.json')).verdict))"
```

The bundled example can report `valid-unanchored`. To verify the example with its supplied Polygon anchor:

```bash
npx authichain-verify node_modules/authichain-verify/examples/polygon-anchor-1.record.json node_modules/authichain-verify/examples/polygon-anchor-1.anchor.json
```

The verifier is intentionally offline: it checks the supplied record and anchor rather than reaching out to confirm an external transaction. A chain explorer or separate evidence source is required for that external fact.

## API

- CLI: `authichain-verify <record.json> [anchor.json]` prints `{ verdict, reasons, checks }` as JSON. It exits 0 for `verified` / `valid-unanchored`, 1 for `invalid` and 2 for usage errors. Set `ALLOW_TESTNET=1` to accept testnet anchors.
- Library: `verifyRecord(record, anchor?, { allowTestnet?, now? })`, plus `canonicalize`, `signingBytes`, `sha256Hex`, `base58Decode` and `publicKeyFromDidKey`.
- Zero dependencies, Node ≥ 18, ESM only.
- The conformance suite stays in the repository: `npm run conformance`.

## Relationship to the live worker

The live worker adds evidence that an offline record cannot know, including issuer trust and durable status/revocation. The two layers are complementary:

`offline protocol checks + live issuer/lifecycle/policy checks → canonical verification decision`

Do not advertise an offline `verified` result as proof that the live issuer still trusts the claim or that a physical item passed inspection.

## Licensing

This component is licensed under the **Apache License 2.0**.
