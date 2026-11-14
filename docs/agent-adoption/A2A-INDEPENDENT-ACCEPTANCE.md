# A2A JSON-RPC independent acceptance matrix (offline review artifact)

Observed/reviewed: 2026-11-14 UTC. Source base: `undone0603/authichain-unified` main `1433f7c45eec722a68692a2ae566eade81a900b8`. This is an **acceptance plan, not a passing interoperability report**. No external requests, paid endpoints, third-party endorsement, or task execution are asserted here.

## Primary specifications and implementation boundaries

- A2A 1.0 normative specification: https://a2a-protocol.org/latest/specification/
- Agent discovery and supported-interface declarations: https://a2a-protocol.org/latest/specification/#8-agent-discovery-the-agent-card
- JSON-RPC protocol binding and methods: https://a2a-protocol.org/latest/specification/#9-json-rpc-protocol-binding
- MCP transport (distinct protocol; do not conflate an MCP `tools/call` with an A2A task): https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- AuthiChain discovery lead: https://authichain.com/.well-known/agent-card.json
- AuthiChain advertised A2A endpoint lead: https://authichain.com/api/a2a

The card was previously observed as HTTP 200 advertising A2A JSONRPC 1.0; **it was not freshly retrieved by this review**. A previous issue statement of “no valid card” is stale as a blanket absence claim, but schema conformance, current reachability, version negotiation, and POST round-trip **remain unverified**. Current official specification includes AgentCard `supportedInterfaces` and JSON-RPC binding requirements; a non-empty `url` alone is insufficient evidence of support.

## Compatibility and negative-case matrix

| Layer | Positive acceptance | Negative / fail-closed acceptance | Evidence required |
|---|---|---|---|
| Discovery | GET card; parse JSON; validate required AgentCard fields, skills, capabilities and `supportedInterfaces` with a pinned schema version | Missing required field, invalid endpoint URL, unsupported protocol binding/version | Raw redacted card, SHA-256, status, retrieval UTC, validator version |
| Interface selection | Choose an actually advertised `JSONRPC` interface and its URL/version | Do not infer A2A 1.0 solely from an unrelated `version` string or MCP descriptor | Selected interface fields and exact schema source |
| Version negotiation | Send compatible version headers/metadata as required by the selected A2A binding | Unsupported or mismatched `A2A-Version` must not silently downgrade | Request headers, status, structured error, exact spec section |
| JSON-RPC envelope | Correlate `jsonrpc: "2.0"` and request/response `id`; validate success/error shape | Reject mismatched `id`, malformed envelope, invalid JSON, ambiguous HTTP 200 error body | Sanitized POST transcript and deterministic validator output |
| Task semantics | With consent and a free/test-only capability, call supported message operation and validate Message or Task response and task state | Do not treat AgentCard GET, HTTP 200 alone, or unsupported method error as a completed task | Real POST trace, response, task ID/state if present, tester identity category |
| Follow-up | For a returned Task, verify supported GetTask semantics and state transition if safely available | Do not invent task completion, streaming, callback delivery or cancellation support | Correlated task retrieval trace and final observed state |
| Security | Verify authentication scheme, authorized test scope, and non-mutating/free fixture | Do not send credentials to a URL absent from trusted card; never call paid or charge-capable tools | Scope declaration, redacted headers, no secrets |
| Independent adoption | Separate owner/house tests from independently operated, opt-in tests | No external-adopter credit from repo CI, operator self-test, issue reaction, or descriptor visibility | Independent operator attestation, exact SHA, timestamp, redacted trace, evidence hash |

## Minimal acceptance procedure for an external consenting tester

1. Pin source commit, runtime/validator version, spec snapshot, and the exact AgentCard bytes; calculate SHA-256. Never copy secrets into evidence.
2. Validate AgentCard against the **matching** A2A version schema, then select only an advertised compatible JSON-RPC interface. Stop if absent.
3. Before POST, confirm the selected skill is free, non-mutating and explicitly authorized for testing; otherwise stop at descriptor audit.
4. Issue one bounded JSON-RPC request with a unique request ID and appropriate version negotiation. Check HTTP status **and** JSON-RPC response shape; record an error as an error.
5. If a real Task is returned, record its ID and observed state; optionally perform a bounded GetTask read if advertised and permitted. Do not claim a completed task unless its final state is actually observed.
6. Save redacted transcript, UTC timestamp, exact source SHA, spec/schema URLs, SHA-256 manifest and negative-case outcomes to owned issue #2326/#2327. External tester must independently reproduce; do not self-certify independence.

## Coordination / status as of review

- Registry acceptance: #2484 — separate discovery from verified listing.
- Free MCP SDK: #2486, merged PR #2488 head `5ad5fe6cef1e095a3611dbbbbe7ed43f55f8905e` — MCP success does **not** imply A2A success.
- Independent acceptance: #2326 / #2327 — no qualifying independent A2A POST transcript established in this document.
- Reciprocal alliance scorecard: #2263 — keep expressed interest, real code contributions, independent passing POST, consented pilot and settled purchase distinct.
- GitLab peer lane: draft MR !2030 at observed source SHA `ee272b52ad44086276d8714bf2ea614006fcf7fc` — not evidence of external acceptance.

**Status: protocol-acceptance fixture documented, live A2A conformance UNKNOWN.** Do not trigger CI, merge, deploy, charge, solicit, or claim a certified listing on the strength of this document.
