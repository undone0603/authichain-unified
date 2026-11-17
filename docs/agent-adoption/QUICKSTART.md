# Integrate AuthiChain in five minutes — free, independently reproducible

AuthiChain exposes public discovery and a bounded free reference verifier. These examples are for agent developers evaluating interoperability, **not** for certifying physical products or authorizing a payment.

## Prerequisites

Node.js >= 22 for the runnable MCP example; `curl` and `jq` for metadata checks. No wallet, API key, email address, account, or checkout.

```bash
# Free-only MCP discovery. Expect exactly verify_record, dpp_readiness_check,
# scan_living_qr. The commercial /mcp endpoint advertises more tools.
curl -fsS https://authichain.com/mcp/free | jq '{serverInfo, tools}'

# Public A2A discovery. This GET is not an end-to-end A2A task test.
curl -fsS https://authichain.com/.well-known/agent-card.json \
  | jq '{name, version, supportedInterfaces, skills: [.skills[]?.id]}'

# Actual free MCP initialize -> tools/list -> tools/call verify_record.
# Uses only the published demonstration record and a pinned free endpoint.
node scripts/agent-adoption/free-record-smoke.mjs

# Ten isolated tests without network, credentials, or payment.
node --test scripts/agent-adoption/free-record-smoke.test.mjs
```

The ten offline regression cases include mismatched JSON-RPC IDs, incompatible initialized protocol versions, and SSE rejection before a downstream tool call. Passing these mocked cases does not establish live endpoint compatibility or independent external adoption.

This example calls only `verify_record` with the published demonstration ID
`polygon-anchor-1`. The service may return `verified`, `unverified`, `invalid`,
or `indeterminate`, depending on real cryptographic and Polygon anchor checks.
Do **not** hardcode the result. Neither a valid signature nor an onchain anchor
proves that a physical product is genuine; missing data is not counterfeit
evidence. The demonstration is owner-authored, **not** independent adoption.

## Distinguish three protocol surfaces

| Purpose | URL | Evidence boundary |
| --- | --- | --- |
| Free MCP | `https://authichain.com/mcp/free` | This script exercises one read-only free POST call |
| Full MCP | `https://authichain.com/mcp` | Tool catalog varies by dated observation; owner-operated `tools/list` reported nine on 2026-11-14, including paid `verify`. Recheck before integration; discovery is not paid use |
| A2A | `https://authichain.com/.well-known/agent-card.json` | An advertised JSON-RPC interface is not proven A2A task compatibility |
| AgentZ x402 | `https://signal.authichain.com/offer` | Public offer metadata; price/SKU may change; no settlement made |

A local `server.json` manifest advertises `com.authichain/authichain` version `1.4.0`, but **current official MCP Registry publication has not been independently confirmed**. Query the official Registry API for the exact name and version, retain the dated response and registry-managed lifecycle metadata, and verify namespace ownership before claiming a published listing. Manifest existence and a search URL do not prove publication or protocol certification. See [registry acceptance #2484](https://github.com/undone0603/authichain-unified/issues/2484).

The existing full MCP transport test is also available:

```bash
node --test scripts/ci/glama-mcp-free-smoke.test.mjs
node scripts/ci/glama-mcp-free-smoke.mjs
```

It exercises its pinned eight-tool GET discovery fixture, JSON-RPC initialize, tools/list, and a
zero-price, nonbinding `negotiate` quote; never paid `verify`.

## Python (no dependencies): discovery only

```python
import json
from urllib.request import urlopen

for url in (
    "https://authichain.com/mcp/free",
    "https://authichain.com/.well-known/agent-card.json",
):
    with urlopen(url, timeout=10) as response:
        data = json.load(response)
    print(url, data.get("serverInfo", {}).get("version") or data.get("version"))
```

The Python snippet is metadata only. The Node script makes the actual free MCP call.

## Independent reproduction

Use the [opt-in evidence-submission guide](./INDEPENDENT_REPRODUCTION.md) and
[GitHub independent-MCP issue form](https://github.com/undone0603/authichain-unified/issues/new?template=independent-mcp-reproduction.yml).
The offline preflight validates the free result's SHA-256, operator consent declaration,
pinned client SHA and paid-call boundary; it **never automatically counts adoption**.
A separate reviewer must verify operator independence and redacted transport evidence.

Do not disclose secrets, customer records, private serials, wallet data,
or payment headers. Exclude house traffic, owner CI, and page views.

The script pins the free endpoint and demo identifier, rejects newly
exposed paid/unknown tools, missing read-only hints, unexpected server
identity, HTTP 402, malformed results and non-demo records. It does not
follow redirects, retry a failed call, or include credentials.
