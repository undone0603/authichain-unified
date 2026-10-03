# AuthiChain Protocol

This directory contains the open-source reference implementation of the AuthiChain verification protocol.

- Spec: [`SPEC.md`](SPEC.md)
- Offline verifier: `node verifier.mjs record.json`
- npm package: [`authichain-verify`](https://www.npmjs.com/package/authichain-verify) — see [Install](#install)

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

- CLI: `authichain-verify <record.json> [anchor.json]` prints `{ verdict, reasons, checks }` as JSON. It exits 0 for `verified` / `valid-unanchored`, 1 for `invalid` and 2 for usage errors. Set `ALLOW_TESTNET=1` to accept testnet anchors.
- Library: `verifyRecord(record, anchor?, { allowTestnet?, now? })`, plus `canonicalize`, `signingBytes`, `sha256Hex`, `base58Decode` and `publicKeyFromDidKey`. Types ship in `verifier.d.ts`.
- Zero dependencies, Node ≥ 18, ESM only.
- The package contains only `verifier.mjs`, its types, the CLI, the example records, `SPEC.md`, this README, `CHANGELOG.md` and `LICENSE`. The conformance suite stays in the repo: `npm run conformance`.

## Licensing

This component is licensed under the **Apache License 2.0**.
