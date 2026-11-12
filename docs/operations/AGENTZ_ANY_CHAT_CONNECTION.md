# AgentZ — connect from any MCP-capable chat

Status: **connection documentation and validation harness**, not universal auto-installation.
The remote AgentZ Cloudflare Worker is deployed. Verified account Workers subdomain: `undone-k`; script subdomain enabled. Network-level MCP handshake and token-protected `tools/list` have **not** been verified in this change.

## One remote address

```text
https://authichain-agentz-mcp-edge.undone-k.workers.dev/mcp
```

The endpoint is a POST-based JSON-RPC MCP server, not the customer-facing eight-tool `https://authichain.com/mcp` (that is a **different server**). Use the AgentZ address only for AgentZ tools. `GET /health` is a public liveness check, **not** readiness for browser execution, CI, or production operations. Avoid guessing a private local-network endpoint.

Current AgentZ tools (from `agentz/cloudflare-mcp/worker.mjs`):
- `agentz_readiness` — capability indicators;
- `agentz_memory_recent` — recent observations;
- `agentz_enqueue_probe` — bounded public GitHub URL probe, an authenticated side effect that queues a task.

The AgentZ Worker explicitly responds `browser_inspect:false`, `code_write:false`, and `production_dispatch:false`. It cannot execute shell commands, CircleCI jobs, browser-control sessions, payments, or GitHub merges. Connecting it to a chat **does not** change that. No chat gets access to a local browser daemon merely by knowing the MCP URL.

## Authentication

The deployed Worker requires a server-side `AGENTZ_MCP_TOKEN` Worker secret on *every* `POST /mcp`, including `initialize` and `tools/list`. Never copy the token into GitHub, a prompt, a public MCP inspector, a chat message, a screenshot, a shareable URL, or a sample config committed to source.

For MCP clients with a secure local secret store and support for custom request headers, configure:

```json
{
  "mcpServers": {
    "agentz": {
      "type": "http",
      "url": "https://authichain-agentz-mcp-edge.undone-k.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer <INSERT_FROM_CLIENT_SECRET_STORE_NOT_REPO>"
      }
    }
  }
}
```

This is a **generic schema illustration**. Actual clients use different field names and secret-substitution mechanisms; verify the specific client's official documentation. Do not place a real token in plaintext config checked into a repository. Do not enable the `agentz_enqueue_probe` tool for unknown users.

### ChatGPT and other hosted chat clients

ChatGPT custom MCP plugins use supported remote MCP transports and OAuth or no-auth connection settings, not arbitrary custom bearer headers entered by a user. **The current AgentZ shared-token endpoint is not yet suitable for direct authenticated ChatGPT plugin installation.** Do not turn authentication off or put a shared service token in a public bridge to make tool discovery succeed.

To connect on ChatGPT web, first implement/deploy a separately reviewed **OAuth 2.1 per-user authorization layer** (authorization-server metadata, PKCE, token rotation/refresh where supported, audience and scope checks, revocation, rate limits, per-user audit, and least-privileged tool authorization); keep the existing Worker token internal behind that adapter. Only after the OAuth endpoint passes conformance/security tests, use **Plugins → + → Add custom MCP server**, register its HTTPS URL, complete OAuth, inspect discovered tools, install it, and select it in chats. Availability is subject to account/workspace permissions. It is not automatically present in all conversations or supported on every client.

**Scope recommendation:** start with the read-only `agentz_readiness` and `agentz_memory_recent` methods for shared-chat use. Queueing public GitHub tasks requires an explicitly authorized user, bounded quotas, and audit evidence. Shell/CI/deploy/payment actions must remain separate protected workflows, never enabled by a generic chat connector.

For API-backed chats, the calling app can use the MCP server URL with an appropriately scoped secret available only server-side. Each app controls whether to enable its connection in each chat. This does not grant the model access to the token.

## Read-only smoke

Run from a credential-isolated and network-connected host, preferably after checking the source's exact SHA:

```sh
node scripts/ci/agentz-remote-mcp-smoke.mjs
# Optional authenticated handshake; use a secret manager to populate env, not shell history:
AGENTZ_MCP_URL=https://authichain-agentz-mcp-edge.undone-k.workers.dev/mcp node scripts/ci/agentz-remote-mcp-smoke.mjs
```

Without `AGENTZ_MCP_TOKEN`, the test checks health and **unauthorized rejection** of `tools/list`. With the token, it additionally runs only `initialize`, `tools/list`, and `agentz_readiness`. It never enqueues a task, uses a browser, writes to D1, or invokes paid APIs. A passing unauthenticated test does **not** imply authorized tool interoperability. The script prints no token or raw response bodies. Stop if the endpoint is unreachable, the token is missing, or a check fails.

## Rollout acceptance

1. Save the exact source SHA, UTC test output, client version, endpoint response status, and MCP protocol version.
2. Confirm unauthenticated `tools/list` and `tools/call` fail closed.
3. Confirm an authorized client can initialize and list exactly the supported capabilities; check false browser/CI/deploy hints.
4. Validate OAuth client flows independently for hosted-chat apps, with per-user revocation and no cross-tenant access.
5. Review and merge with the repository's enforced branch protection; never deploy the shared-token Worker to bypass a missing OAuth bridge.
6. For each chat app, explicitly install or enable the connection. Connection in one ChatGPT conversation does not retroactively authorize all apps, users, or sessions.

This work does **not** change `humanHold`, `production_send`, financial authorization, checkout, deployment gates, or the `ae/rule18-gate` rule.
