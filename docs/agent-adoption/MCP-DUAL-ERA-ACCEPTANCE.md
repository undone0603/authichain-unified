# MCP dual-era transport acceptance — source-pinned review

Observation date: 2026-11-14 UTC. Scope: offline acceptance design only; no paid calls, production changes, or unaffiliated tester claims.

## Source and implementation boundaries

- Official modern Streamable HTTP: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- Official 2026 changelog: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Legacy lifecycle: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- Current main test source: `scripts/agent-adoption/free-record-smoke.test.mjs`, blob SHA `02db942e4266470571bb96b64367db74254f59e1` (read back 2026-11-14).
- Existing acceptance: #2484, #2486, #2326, #2327; central coordination #2263.

## Important version split

| Acceptance dimension | Handshake era (2025-06-18) | Modern era (2026-07-28) |
|---|---|---|
| Lifecycle | `initialize` / initialized notification | No handshake; optional `server/discover` |
| Version | Negotiated during initialization; version header for later HTTP requests | Per-request `MCP-Protocol-Version` matching body `_meta` |
| Sessions | Optional `Mcp-Session-Id` | Protocol-level sessions removed |
| HTTP | POST JSON-RPC; JSON or SSE response; legacy GET stream permitted | Each request its own POST; JSON or request-scoped SSE response; no GET stream |
| Notifications | Initialized notification; 202 Accepted for accepted notification | No core client-to-server HTTP notifications; do not transplant legacy test assumptions |
| Tool output | Interpret `isError` and content; never infer physical authenticity | Check modern result envelope and `resultType` according to negotiated era |

**Do not require modern-era requests to perform a legacy initialize handshake, or require modern servers to issue session IDs.** Do not claim a legacy implementation is broken solely because it does not support the newer era.

## Offline acceptance vectors (not yet implemented or executed here)

1. Legacy positive: initialize -> initialized -> tools/list -> demo-only tools/call; check negotiated version and `Mcp-Session-Id` propagation only if issued.
2. Legacy negative: malformed session ID, unsupported negotiated version, mismatched JSON-RPC response ID; fail closed.
3. Modern positive: request-scoped POST `server/discover` and `tools/list`, with required per-request metadata and headers; no initialize or session dependency.
4. Modern negative: mismatched header/body protocol versions -> reject; unsupported version -> structured failure; invalid Origin -> 403.
5. Shared transport: accept a well-formed request-scoped SSE final response, reject malformed SSE, unrelated response IDs and unexpected server-initiated requests.
6. Payment boundary: HTTP 402 -> stop immediately, never retry with payment credentials or paid `verify`; unknown record remains unknown rather than counterfeit.
7. Evidence semantics: signature validity, record existence, anchoring, claim verdict, and payment settlement are distinct; never assert physical authenticity from a signature.

## Acceptance evidence requirements

For each fixture record exact Git commit, command, runtime version, exit code, redacted request/response, test-case result, source URL and observation time. Only independent operators can satisfy independent external adoption; self/house tests do not count. A published descriptor or a green CI status is not a certified registry listing or a successful A2A task.

No CI reruns, release actions, purchases or outbound contact are authorized by this document.
