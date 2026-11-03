# AuthiChain × RelayMarket — reproducible documentary interoperability fixture

**Prepared:** 2026-11-03  
**Status:** delivered as public documentary evidence; **not** independently accepted or a live protocol conformance result.  
**Source:** [RelayMarket interoperability test](https://github.com/Kosta1985/relaymarket/blob/main/docs/INTEROPERABILITY.md).  
**Independent operator authorization:** not yet granted to AuthiChain for an endpoint-specific test.

## Protocol evidence matrix

| RelayMarket documented check | AuthiChain evidence status | Boundary / next action |
| --- | --- | --- |
| Fetch public A2A Agent Card | NOT TESTED | Need approved exact public URL; distinguish transport reachability from identity. |
| MCP `initialize` | NOT TESTED | Protocol request can be POST; obtain operator authorization first. |
| MCP `tools/list` | NOT TESTED | Do not infer advertised tools from README. |
| `relaymarket_discover_agents` | NOT TESTED | Do not create fake agents or assume authorization for MCP calls. |
| A2A `message/send` `discover_agents` | NOT TESTED | Method may be POST even when semantically read-only; explicit scope required. |
| OpenAPI and `/health` reachable | NOT TESTED for RelayMarket | Public AuthiChain pilot `/health` separately fetched and returned `status:ok`; not RelayMarket evidence. |
| Meaningful `X-RelayMarket-Source` | NOT TESTED | Proposed value `authichain-public-pilot-20261103`; only send after approval. |
| Real cross-operator task delivery | NOT TESTED | Requires separate operator, scoped task, independent acceptance and receipts. |
| Customer payment | NOT VERIFIED | No claim of revenue, GMV, or paid partnership. |

## Reproduction

1. Read the linked RelayMarket interoperability specification at a pinned commit before testing; document its commit SHA.
2. Ask the RelayMarket operator to identify approved endpoint URLs, discovery methods, request limits, and test window.
3. Record request timestamp (UTC), exact URL, method, status code, relevant content type and sanitized response digest.
4. Use **no registration, task creation, credentials, state-changing calls, or synthetic transactions** in the read-only phase.
5. Record every outcome as `observed`, `failed`, `not tested`, or `inconclusive`. Distinguish GET requests from read-only POST protocol methods.
6. Produce a canonical JSON manifest and SHA-256 digest; request independent operator reproduction and written acceptance.

## Existing public AuthiChain evidence (not RelayMarket conformance)

- Landing: https://authichain-public-pilot.undone-k.workers.dev/
- Health: https://authichain-public-pilot.undone-k.workers.dev/health
- Cloudflare deployment ID: `49f81157-b3a5-4423-a083-bc10b90bd672`.
- Source commit: `a7ba0846428d1950729081dc3299e57ae990fc12`.
- External fetch observed page title `AuthiChain | Independent verification pilot` and `{"status":"ok","surface":"public-pilot","transactions":false}` from `/health`.

## Acceptance request

Please respond explicitly with: (a) whether RelayMarket accepts this documentary fixture; (b) exact approved public URLs and read-only methods, including whether MCP/A2A POST discovery is permitted; (c) any rate limits and preferred evidence format. Silence is not acceptance.
