# Independent public MCP discovery observation — 2026-11-05 UTC

## Scope and method
An independent network-capable fetch service retrieved **GET** `https://authichain.com/mcp` with freshness tolerance 0. No authentication, payment, tool invocation, or state-changing request. The service reported no fetch errors. This is **discovery observation only**, not MCP protocol POST conformance or signed independent certification.

## Observed
- Response parsed as JSON after normalizing escaped underscores in the extraction format.
- `protocol: "mcp"`; `jsonrpc: "2.0"`.
- `serverInfo.name: "authichain"`, `serverInfo.version: "1.4.0"`.
- Seven advertised tools: `get_pricing`, `verify`, `query_provenance`, `verify_attestation`, `verify_record`, `dpp_readiness_check`, `scan_living_qr`.
- Tool descriptions advertise free verification and an x402 paid path; **descriptions do not establish that either executes successfully**.

## Not tested
- HTTP POST JSON-RPC `initialize`/`tools/list` and version negotiation, content type, sessions, streaming or dual-era compatibility.
- `tools/call` success/failure semantics; actual registry data, cryptographic attestation validation or independent reproduction.
- x402 payment challenge, settlement, buyer acceptance or revenue.
- Runner host identity, isolation, CI passing status or deployment provenance.

## CI snapshot
At inspection, commit `fafd7b858bbda685167cffe31ea95399f37cadaf`: Worker builds run 41966103348 was in progress at checkout; CI, CI Main, Lint, Typecheck ratchet queued. This is a snapshot, not a final conclusion.

## Reproduction
1. Independently GET `https://authichain.com/mcp`, preserve raw response bytes, UTC timestamp, HTTP status, headers and SHA-256.
2. Confirm JSON schema and seven advertised tool names.
3. On a separately authorized test host, execute the repository's read-only dual-era POST probe and preserve redacted raw fixtures and checksums.
4. Obtain an independent operator's written acceptance before labeling a cross-operator pilot successful.

**Release/commercial hold:** no merge, deploy, payment, contact, certification or revenue claim based on this observation. `humanHold=true` and `production_send=false` remain unchanged.
