# AuthiChain Protocol

This directory contains the open-source reference implementation of the AuthiChain verification protocol.

- Spec: [`SPEC.md`](SPEC.md)
- Offline verifier: `node verifier.mjs record.json`
- npm package (prepared, **not yet published**): `authichain-verify` — see [Install](#install)
- QFS-ready ISO 20022 carriage: [`qfs/`](qfs/) — `pacs.008` envelope, dual digest, ML-DSA-65 slot reserved. Not a bank rail.

## Install

> Not on npm yet. Until it is published, build a tarball with `npm pack` in this directory and install that file instead of the package name.

```bash
npm install authichain-verify
npx authichain-verify node_modules/authichain-verify/examples/record.json
node -e "import('authichain-verify').then(({verifyRecord})=>console.log(verifyRecord(require('./node_modules/authichain-verify/examples/record.json')).verdict))"
```

Both of the last two lines verify the bundled example record offline and report `valid-unanchored`. Point them at your own record (and optional anchor: `authichain-verify record.json anchor.json`) to check real ones.

- CLI: `authichain-verify <record.json> [anchor.json]` prints `{ verdict, reasons, checks }` as JSON. It exits 0 for `verified` / `valid-unanchored`, 1 for `invalid` and 2 for usage errors. Set `ALLOW_TESTNET=1` to accept testnet anchors.
- Library: `verifyRecord(record, anchor?, { allowTestnet?, now? })`, plus `canonicalize`, `signingBytes`, `sha256Hex`, `base58Decode` and `publicKeyFromDidKey`. Types ship in `verifier.d.ts`.
- Zero dependencies, Node ≥ 18, ESM only.
- The package contains only `verifier.mjs`, its types, the CLI, one example record, `SPEC.md`, this README and `LICENSE`. The conformance suite stays in the repo: `npm run conformance`.

## Licensing

This component is licensed under the **Apache License 2.0**.
