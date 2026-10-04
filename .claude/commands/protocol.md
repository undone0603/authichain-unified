---
description: Run the open verifier on the Polygon-anchored record and show the live verdict
---

Check AuthiChain's published, Polygon-anchored demonstration record and report the result. Read-only: no deploys, no transactions, no keys.

1. Run the reference verifier offline from the repo root:
   `node protocol/verifier.mjs protocol/examples/polygon-anchor-1.record.json protocol/examples/polygon-anchor-1.anchor.json`
   Expect `"verdict": "verified"` with `signature` and `anchorHash` both `true`.
2. Show the anchor: `protocol/examples/polygon-anchor-1.anchor.json` (Polygon mainnet, tx `0x24911473b03c19f3b1ee9b0887fd82ef648bf2c85386f9505a0336a9c1ae10b7`, block 94,680,852).
3. If network access allows, fetch the live verdict from `https://authichain.com/api/verify?id=polygon-anchor-1` and confirm `anchorOnChain: true` and `anchorChainStatus: "tx_contains_record_hash"`. If authichain.com is blocked from this environment, say so rather than guessing.
4. Report in a few lines: offline verdict, live verdict, and the Polygonscan link. Do not describe the record as a product, customer, or battery passport. It is a protocol demonstration.

$ARGUMENTS
