# MCP/A2A capability preflight and safe autonomous rollout

Status: **source-only branch, not merged or deployed** (2026-11-04).
Owner: AuthiChain / AgentZ.
Parent design: \`docs/agent-connectivity/MCP_A2A_SETUP.md\`.

## Contract: do not conflate four separate operations

1. **GET /negotiate** and **GET /api/negotiate** list public read-only capabilities. This is an **AuthiChain-specific preflight**, not a protocol-standard operation.
2. **POST /negotiate** compares the caller's *offered* legacy MCP handshake versions, A2A interface versions, and requested read-only capabilities. It always returns \`authorized: false\` and \`connected: false\`. It makes **no outbound HTTP call, token, task, payment, signature, or durable record**.
3. **MCP tool \`negotiate\`** returns the same pure compatibility assessment via existing \`tools/call\`. MCP's own \`initialize\` (2025-era) or \`server/discover\` (2026-07-28) is still required by clients. AuthiChain currently supports only handshake versions 2025-06-18, 2025-03-26 and 2024-11-05, so it must not advertise 2025-11-25 or the 2026-07-28 era.
4. **A2A Agent Card** advertises an additional *read-only setup-discovery skill*; its existing 1.0 JSON-RPC \`SendMessage\` may explain the preflight link. There is **no new nonstandard \`Negotiate\` A2A JSON-RPC method**, no remote peer, and no A2A permission minted by an Agent Card.

### Example safe request

~~~http
POST /negotiate HTTP/1.1
Host: authichain.com
Content-Type: application/json

{"intent":"discover","mcpVersions":["2025-06-18"],"a2aVersions":["1.0"],"capabilities":["mcp.tools.list","a2a.agent_card.read"]}
~~~

Expected (abridged): \`status=compatible_read_only\`, \`mcp.selectedVersion=2025-06-18\`, \`a2a.selectedVersion=1.0\`, \`authorized=false\`, \`connected=false\`.

Reject \`intent: "connect"\`, \`"message"\`, \`"sign"\`, \`"pay"\`, \`"settle"\` or unknown capabilities with \`approval_required\` and HTTP 403. Unsupported explicit versions receive \`unsupported\` and HTTP 422. Invalid keys/types receive \`invalid_request\` and HTTP 400. Inputs larger than 4096 bytes fail with 413. Cross-origin browser requests fail with 403. This API never accepts secrets, URLs to fetch, headers to forward or arbitrary peer hosts.

## Release sequence: smallest real evidence first

| Phase | Function(s) | Evidence gate | Automation permission |
| --- | --- | --- | --- |
| 0: hold | Current public MCP \`initialize\`, \`tools/list\`, Agent Card GET | Snapshot known live version and sha, explicitly distinguish from branch | Read-only monitoring only |
| 1: source | \`/negotiate\`, \`/api/negotiate\`, MCP \`negotiate\` tool, A2A skill/link | Local Vitest and TS compile; prove all denial cases; review against upstream protocol specs | Draft changes only; **no PR-triggered self-hosted runner until host attested** |
| 2: interop | \`tools/list\`, \`get_agent_setup_offers\`, \`negotiate\`, Agent Card | Independent operator runs MCP Inspector and A2A Inspector against approved staging host; fixed expected commit SHA, output hashes and negative fixtures | Record PASS/FAIL/NOT EXECUTED with timestamp/source, no unverified badge |
| 3: evidence | \`verify_record\`, \`verify_attestation\`, \`query_provenance\` | Positive signed fixture, invalid signature, unknown registry record, independently observed anchor; **never claim physical product authenticity** | Read-only bounded synthetic probes |
| 4: products | \`dpp_readiness_check\`, \`scan_living_qr\`, issuer acceptance | Scanner-condition matrix, false-positive and provenance risk audit, accepted evidence and privacy gates | Propose scoped draft PRs with tests, not auto-publish |
| 5: permitted peers | A2A \`SendMessage\`, policy/Agent Passport, signed A2A envelope, optional MCP peer exchange | Written peer operator permission, domain+identity check, scoped authority, task receipt, revocation, independent reproduction | Only owner-approved, rate/budget limited peer task, no unsolicited outreach |
| 6: economy | x402 payment and commercial setup, API negotiation of offers | Independent actual buyer, Stripe/processor eligibility and receipt, fulfilled customer outcome, independent security review | **Financial and production \`humanHold\` gates remain** until separately approved |

Each phase is reversible and must not mark itself complete on source tests alone.

## Continuous research and update policy

Weekly, and after any upstream protocol security advisory or release:
- Compare the **MCP 2026-07-28** stateless lifecycle/\`server/discover\` and 2025-11-25 handshake changes against the deployed \`/mcp\` implementation. Do not upgrade the advertised supported versions until the *actual wire protocol* implements and passes both modern and legacy test suites.
- Compare **A2A v1.0.x** Agent Card \`supportedInterfaces\`, JSON-RPC transport, authentication declaration, task idempotency/state semantics and trust requirements.
- Check upstream **MCP Inspector, A2A Inspector and official SDKs** for new conformance and negative tests. Pin versions/SHAs and archive small redacted request/response fixtures with SHA-256 manifests.
- Check AuthiChain PRs and actual live endpoints; produce a dated evidence table (\`observed\`, \`not_tested\`, \`inconclusive\`, \`failed\`) and open/update **draft proposals only**, avoiding duplicates and surprise third-party messages.
- Make no automated merge, production deployment, credentials, paid traffic, A2A messages, financial transfers, session minting or customer fulfillment without separately satisfied controls.
- Respect daily/weekly budget: no new paid services or usage charges for preflight; retain input/time limits and never log request bodies or personal data. Avoid writing unknown partner Agent Cards to the database.

**Runner stop condition:** PR-triggered GitHub Actions currently route to a persistent self-hosted host. Obtain host isolation and credential-boundary attestation, independent review of security-routing PRs and exact-head CI evidence *before* enabling or running any untrusted PR jobs. A successful GitHub status on a different SHA does not pass this gate.

## Independent acceptance evidence template

- Commit SHA and test program SHA (no floating branch labels).
- Validator organization, operator identity (with permission to name), pinned test-client version/commit, host isolation attestation.
- UTC timestamp, target origin, HTTP status/content-type, redacted request and response SHA-256.
- Per gate PASS / FAIL / NOT EXECUTED with exact reproduction instructions.
- Separate explicit peer acceptance reference; no automatic claim of partnership, certification or commercial revenue.

## Primary specifications and reproducible inspectors

- [MCP 2026-07-28 specification announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/) — stateless era, \`server/discover\`, \`_meta\` capability envelope.
- [Official TypeScript MCP SDK: protocol-version behavior](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions).
- [Official TypeScript MCP SDK migration guidance](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28).
- [A2A v1.0 agent-card change reference](https://a2a-protocol.org/v1.0.1/whats-new-v1/) — supported interfaces now carry protocol versions.
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector).
- [A2A Inspector](https://github.com/a2aproject/a2a-inspector).

No link in this document implies a passing independent test result or outside endorsement.
