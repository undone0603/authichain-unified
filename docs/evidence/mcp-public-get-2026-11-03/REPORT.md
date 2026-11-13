# AuthiChain /mcp owner-controlled public evidence (2026-11-03)

Target: https://authichain.com/mcp
Status: OWNER-AUTHORED DOCUMENTARY SAMPLE. No full MCP conformance, independent acceptance, or verified revenue.

## Evidence matrix

| Claim or check | Classification | Evidence boundary |
| --- | --- | --- |
| GET advertises seven tools and server 1.4.0 | OBSERVED | Owner issue #2326 records a GET; an additional public web retrieval displayed the same JSON metadata. No original HTTP status, headers, raw response bytes or raw-response hash have been preserved. |
| Eighth `negotiate` tool | SOURCE-ONLY | In unmerged draft PR #2324 head `cd3a23341746f134b9e5d02f44d05d7102570d3f`, not verified deployed. |
| Modern `2026-07-28` `server/discover` and `tools/list` POST | NOT TESTED | No authorized live request/response. |
| Legacy `2025-06-18` initialize / initialized / tools/list POST | NOT TESTED | No authorized live request/response. |
| Dual-era POST compatibility | INCONCLUSIVE | GET metadata does not demonstrate JSON-RPC POST compatibility. |
| Exact-head CI and independent code review | NOT VERIFIED | Issue #2327 records unresolved checks and review. |
| RelayMarket field mapping | SUBMITTED | Owner-authored fixture linked in TaskBay #34, not independently accepted. |
| Operator permission to AuthiChain | NOT ESTABLISHED | Existing TaskBay maintainer approval was for Compacitas; authorization is not transferable. |
| Independent reproduction, task completion, customer revenue | NOT VERIFIED | No separate reviewer acceptance, genuine task completion receipt, or independent paid settlement. |

`GET-public-summary.json` is a REDACTED DOCUMENTARY SUMMARY, **not** an actual HTTP capture. Its null values mean not preserved/not performed. `manifest.sha256` hashes these authored files, not the server's original HTTP bytes. This package is UNSIGNED.

## Reproduction, only when authorized

A reviewer permitted to perform a public GET can collect reproducible raw evidence:

```bash
curl --proto '=https' --max-redirs 0 --silent --show-error \
  --dump-header mcp-get.headers.txt --output mcp-get.body.json \
  'https://authichain.com/mcp'
sha256sum mcp-get.body.json
```

NO live POST was performed for this package. Do not run `scripts/interop/mcp-dual-protocol-readonly.mjs` until the actual endpoint operator has given target-specific written permission for URL, exact methods, rate limits, test window and handling/retention. Do not invoke `tools/call`, agent registration, state changes, payments or production deployment.

## Exact missing acceptance reference

- **Permission:** a new operator-authored comment permalink in TaskBay issue #34 specifically authorizing AuthiChain's named target and methods.
- **Reproduction:** an independent review/run permalink identifying the pinned report revision and actual evidence.
- **Acceptance:** a new TaskBay operator/reviewer permalink explicitly accepting the reviewed deliverable. **NONE FOUND.** The existing AuthiChain comment is a submission, NOT acceptance: https://github.com/Kosta1985/relaymarket/issues/34#issuecomment-6609997395
- **Cross-operator completed task:** additionally needs real unrelated requester task ID and authenticated completion/acceptance receipt.

Sources:
- https://github.com/undone0603/authichain-unified/issues/2326
- https://github.com/undone0603/authichain-unified/issues/2327
- https://github.com/undone0603/authichain-unified/pull/2324
- https://github.com/undone0603/authichain-unified/blob/0b2c5fb253ff9b9a1e76052ea668a348a2fa8e17/launch/zero-cost-pilot/RELAYMARKET-EVIDENCE.md
- https://github.com/Kosta1985/relaymarket/blob/main/docs/INTEROPERABILITY.md

No prospect contact, agent registration, unauthorized POST, signature, payment, or revenue claim. Keep `humanHold=true`, `production_send=false` and protected review and release gates.
