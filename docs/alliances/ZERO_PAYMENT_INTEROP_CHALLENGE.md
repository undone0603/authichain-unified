# AuthiChain zero-payment external interoperability challenge (draft)

**Scope:** Independent, consent-based, read-only technical validation. No endorsement, partnership, identity proof, paid settlement, authenticity verdict, or conformance claim is implied.

## Safety and provenance
- Record reviewer GitHub identity/organization, UTC timestamp, runner OS, tool versions, tested git SHA and source URL; identify who executed tests separately from who reviewed/approved them.
- Pin official MCP and A2A specification/TCK revisions by immutable commit or release digest before testing; record selected protocol version in each request and response. Never silently downgrade.
- Use only public GETs and explicitly authorized MCP JSON-RPC initialize/notifications/\`tools/list\` or modern stateless discovery/list POST; no \`tools/call\`, private agents, credentials, wallets, settlement, or production mutations.
- A2A TCK only on isolated staging with operator permission; public AgentCard GET is metadata inspection, **not** task authorization or TCK certification.
- Fail closed on missing network, unpinned binary, unexpected response, malformed JSON-RPC, unsupported protocol, or missing attribution. Never report a GET as a POST handshake.

## Test matrix (fill actual responses, never placeholders as passes)
| ID | Fixture | Expected safety assertion |
| --- | --- | --- |
| MCP-LEG-INIT/NOTIF/LIST | Explicit 2025-06-18 legacy initialize + initialized notification + tools/list on approved host | Actual HTTP status, headers, JSON-RPC result and tools list captured |
| MCP-MOD-DISCOVER/LIST | Explicit 2026-07-28 modern stateless discovery/list on approved host | Actual response and negotiated version; unsupported is recorded, not silently downgraded |
| MCP-NEG | Missing/mismatched version, malformed resultType, bad JSON-RPC ID | Reject or report incompatibility; never mark conformant |
| A2A-CARD | Public well-known AgentCard metadata | Note signature/securitySchemes presence/absence; do not infer identity |
| A2A-ISOLATION | On credential-free local/staging executor, SendMessage A then ListTasks/GetTask as anonymous B | B cannot enumerate A's task ID or content |
| A2A-BATCH | SendMessage then ListTasks within same isolated RPC batch | Only current batch visibility; no persistence into later request |
| A2A-BODY | 65,537-byte body, multibyte UTF-8, missing/invalid Content-Length, truncated stream | Bounded fail-closed behavior, no task created or leakage |
| VERIFY-UNKNOWN | Public verify unknown synthetic ID | not_found is not counterfeit |
| VERIFY-DEMO | Public documented demonstration ID | demonstration and physical-binding caveats retained |
| TRUST-NEG | Forged/unsigned AgentCard, raw verifier result, x402 health | None alone authorizes principal, enforcement or payment |

## Execution and evidence report
- Reviewer identity and independent relationship to author:
- Test operator identity and consent:
- Repository exact commit SHA and file blob hashes:
- Spec/TCK release tag, immutable commit and binary SHA256:
- Runner identity/isolation evidence, UTC start/end:
- Exact sanitized commands and target URLs:
- Per fixture: request method, protocol version, HTTP status, response headers, redacted JSON-RPC response, exit code, UTC timestamp, PASS/FAIL/UNTESTED and reproduction:
- CI URL with exact head SHA, required contexts and outcomes:
- Security reviewer approval URL and reviewed SHA:
- Known limitations and deviations:
- **Decision:** unverified / reproducible failure / partial technical evidence / independently reviewed (never endorsed automatically).

## Release and business boundaries
PR #2269 request-local task isolation and byte-limit regressions take precedence. Execute native A2A library and Worker route tests only on an approved credential-free disposable executor, then exact-head CI and eligible independent security review. Do not dispatch untrusted PR code on persistent credentialed runners. PR #2268 remains evidence-only and non-accusatory. No automated quarantine, external allegations, merge, deploy, charge, wallet activity, unsolicited messages, or relaxation of humanHold=true / production_send=false.

Discovery listings (MCP Registry, x402 Bazaar, Agentverse) are separate from technical acceptance. Any pilot requires a consenting counterparty, written acceptance criteria, explicit price authorization if paid, and independently evidenced fulfillment.
