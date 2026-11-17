# A2A Agent Card offline descriptor audit (not protocol certification)

This optional, zero-network, zero-payment fixture audits a **user-supplied saved JSON Agent Card** for AuthiChain's expected JSON-RPC v1.0 target. It does not fetch live data, mutate production, send an A2A task, contact another operator, or establish a peer integration.

1. With consent, save the public card from `https://authichain.com/.well-known/agent-card.json` to `agent-card.json`. Record UTC, HTTP status, exact raw bytes SHA-256 and retrieval URL separately. **A GET status alone is discoverability, not task conformance.**
2. Inspect the JSON before sharing or executing anything. Run `node scripts/alliances/a2a-card-evidence-audit.mjs agent-card.json` and `node --test scripts/alliances/a2a-card-evidence-audit.test.mjs` (Node 22 or newer).
3. The audit checks nonempty name, version and skills, plus at least one declared `supportedInterfaces` entry using `JSONRPC`, protocolVersion `1.0`, and exactly `https://authichain.com/api/a2a`. An optional primary `url` is inspected too. Wrong host, HTTP downgrade, URL credentials and query strings fail closed.
4. Even a `DESCRIPTOR_REVIEW_REQUIRED` result **does not validate the complete official A2A schema**. It always returns `descriptorOnly=true`, `a2aTaskAccepted=false`, and `externalIntegrationCounted=false`. An actual independent task requires a pinned official A2A schema, permitted remote JSON-RPC request/response IDs, task lifecycle, safe evidence, operator consent and a distinct acceptance record. The fixture does not assert that the live card passes these checks.

The fixture is deliberately conservative and may reject legitimate alternate A2A deployment shapes. It is scoped to the currently advertised AuthiChain target only, not a universal A2A validator. Do not reinterpret an offline passing descriptor as an independently passing POST or partner endorsement.

Evidence tracking: [#2263](https://github.com/undone0603/authichain-unified/issues/2263), [#2326](https://github.com/undone0603/authichain-unified/issues/2326), [#2327](https://github.com/undone0603/authichain-unified/issues/2327). This fixture does not replace the separate free-MCP intake [#2486](https://github.com/undone0603/authichain-unified/issues/2486) or x402 settlement acceptance.
