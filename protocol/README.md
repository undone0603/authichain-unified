# AuthiChain Protocol

This directory contains the open-source reference implementation of the AuthiChain verification protocol.

- Spec: [`SPEC.md`](SPEC.md)
- Offline verifier: `node verifier.mjs record.json`
- npm package: [`authichain-verify`](https://www.npmjs.com/package/authichain-verify) — see [Install](#install)

## Quickstart: verify offline

Works today with the published package (`authichain-verify` 0.1.1 on npm). Nothing here needs an account or contacts an AuthiChain server.

```bash
npm install authichain-verify
npx authichain-verify node_modules/authichain-verify/examples/record.json
# {"verdict": "valid-unanchored", "reasons": [], "checks": {"signature": true}}
```

The record carries its signer as a `did:key`; the verifier checks the Ed25519 signature over the RFC 8785 canonical form of the record. Edit any field in the JSON and run it again: the verdict becomes `invalid` with `signature_invalid`.

### Check a seal against the published key (next release, not on npm yet)

AuthiChain publishes its attestation signing key as a JWKS at <https://authichain.com/protocol/jwks.json> (also at `/.well-known/jwks.json`). It holds Ed25519 keys in the standard JWK form `{"kty":"OKP","crv":"Ed25519","x":"<base64url>","kid":"…","use":"sig","alg":"EdDSA"}`. Download it once; every check after that is offline.

```bash
curl -sO https://authichain.com/protocol/jwks.json

# A compact-JWS attestation seal (header typ "AC-ATTESTATION+JWS"):
npx authichain-verify --jwks jwks.json seal.jws

# A JSON record, additionally requiring its did:key signer to be a key in the JWKS:
npx authichain-verify --jwks jwks.json record.json
```

To see it work without a real seal, the package ships the repo's public test fixture and its test key:

```bash
npx authichain-verify --jwks node_modules/authichain-verify/examples/attestation-fixture.jwks.json \
  node_modules/authichain-verify/examples/attestation-fixture.jws
# verdict "valid-offline"; the -tampered.jws fixture gives "invalid" / "signature_invalid"
```

(The fixture payload expires 2027-01-01, after which the same command reports `expired`.)

What a seal check covers: EdDSA with `typ` `AC-ATTESTATION+JWS`, a `kid` found in your JWKS, a valid signature, an unexpired payload, and a signed `decision: "verified"` with `status: "active"`. What it does **not** cover: live revocation or supersession (that status lives in the issuer's registry and needs a network call), and whether the physical item in your hand is the one the seal names. A valid signature proves who signed the payload and that it wasn't changed, nothing more.

Library: `verifyAttestationJws(jws, jwks, { now? })` and `verifyRecord(record, anchor, { jwks })`, plus `didKeyFromJwk(jwk)`.

### Python

A Python port with the same checks and CLI lives in [`python/`](python/) (`authichain_verify`, depends only on `cryptography`). It passes the same 28 conformance fixtures under `--strict` and ports the JS unit tests. It is not on PyPI yet.

## Install

```bash
npm install authichain-verify
npx authichain-verify node_modules/authichain-verify/examples/record.json
node -e "import('authichain-verify').then(({verifyRecord})=>console.log(verifyRecord(require('./node_modules/authichain-verify/examples/record.json')).verdict))"
```

Both of the last two lines verify the bundled example record offline and report `valid-unanchored`. To check a record anchored on Polygon mainnet, run:

```bash
npx authichain-verify node_modules/authichain-verify/examples/polygon-anchor-1.record.json node_modules/authichain-verify/examples/polygon-anchor-1.anchor.json
```

That reports `verified`: the signature checks and the anchor carries the record's hash. The verifier never goes online, so it doesn't confirm the transaction itself (`0x24911473…` in Polygon block 94680852). Look that up on any Polygon explorer. Point them at your own record (and optional anchor: `authichain-verify record.json anchor.json`) to check real ones.

- CLI: `authichain-verify [--jwks jwks.json] <record.json> [anchor.json]` (or `--jwks jwks.json <seal.jws>`) prints `{ verdict, reasons, checks }` as JSON. It exits 0 for `verified` / `valid-unanchored` / `valid-offline`, 1 for `invalid` and 2 for usage errors. Set `ALLOW_TESTNET=1` to accept testnet anchors.
- Library: `verifyRecord(record, anchor?, { allowTestnet?, now?, jwks? })`, `verifyAttestationJws(jws, jwks, { now? })`, plus `canonicalize`, `signingBytes`, `sha256Hex`, `base58Decode`, `base58Encode`, `publicKeyFromDidKey` and `didKeyFromJwk`. Types ship in `verifier.d.ts`.
- Zero dependencies, Node ≥ 18, ESM only.
- The package contains only `verifier.mjs`, its types, the CLI, the example records and attestation test fixture, `SPEC.md`, this README, `CHANGELOG.md` and `LICENSE`. The conformance suite stays in the repo: `npm run conformance`.

## Licensing

This component is licensed under the **Apache License 2.0**.
