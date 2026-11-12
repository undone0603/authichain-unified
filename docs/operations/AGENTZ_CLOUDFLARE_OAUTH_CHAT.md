# AgentZ OAuth-backed ChatGPT MCP — protected release design

Status: implementation candidate; **not** live, deployed, approved, or installed.

## Why not reuse the existing shared MCP token?

Existing `authichain-agentz-mcp-edge` uses the `AGENTZ_MCP_TOKEN` secret as a machine credential. ChatGPT custom MCP apps cannot supply that shared secret as a user-provided header. Exposing it would bypass per-user identity and auditing.

Cloudflare Access **Managed OAuth** supports standards-based interactive OAuth for MCP clients. The account already has the `ac-agentz` Access application on `agentz.authichain.com`, restricted to founder email and machine tokens. Do **not** replace or modify that app: it may protect another AgentZ service. Create a **separate founder-only Access application** on a distinct, verified hostname that routes to the ChatGPT MCP Worker, for example `agentz-chat.authichain.com`, after the code is tested and release-approved.

Cloudflare OAuth documentation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/

## Resource server authentication change

`access-auth.mjs` authenticates a signed Cloudflare Access JWT passed in the `Cf-Access-Jwt-Assertion` header. Do not trust the presence of this header alone: requests to the underlying public Worker URL can forge headers. The verifier checks **RS256 signature** using issuer-pinned Cloudflare Access JWKS, the exact application `aud`, issuer, email, user identity and bounded expiry.

Enable **only** when all three Worker runtime configuration values exist:

- `AGENTZ_ACCESS_ISSUER`: exact HTTPS Cloudflare Access team origin, verified account currently `https://strainchainexecutiveteam.cloudflareaccess.com`
- `AGENTZ_ACCESS_AUD`: exact audience of the **new** founder-only Access app (not the preexisting `ac-agentz` audience)
- `AGENTZ_ACCESS_OWNER_EMAIL`: allowlisted founder email, set via approved config management

These are configuration identifiers, not secret keys. The machine-side `AGENTZ_MCP_TOKEN` and scheduled dispatch credentials remain unmodified and are not returned to clients. With no Access config the new OAuth path fails closed. Never run an OAuth-authenticated session against `agentz_enqueue_probe`; verified interactive users can only call `agentz_readiness` and `agentz_memory_recent`. The existing machine credential still retains its established task queue permission.

**Limitation:** The MCP tool catalogue currently advertises `agentz_enqueue_probe` to OAuth users even though calling it fails with an error. Before broad user access, split tool discovery by principal so chat sessions see only the two read-only tools. For the founder-only setup, the runtime rejects the action; do not describe it as available to ChatGPT users.

## Proposed protected setup, no unsafe shortcut

1. Obtain an exact-head passing CI job on the OAuth patch: `node --test agentz/cloudflare-mcp/access-auth.test.mjs agentz/cloudflare-mcp/worker-runtime.test.mjs`; review signature, audience, role and key rotation behavior.
2. Confirm required `ae/rule18-gate` on the protected main and any applicable deployment gate. Do not bypass a branch or environment policy.
3. Create a **new** named Access application for the dedicated MCP hostname with a founder-identity-only allow policy, no service-token exemption, and Managed OAuth enabled. Do not change preexisting Access apps or shared-token routes.
4. Route the dedicated hostname to the existing isolated AgentZ MCP Worker only after checks and security approval. Verify Access responds with the expected OAuth `401 WWW-Authenticate` discovery and valid authorization server metadata; never publish a shared token in the ChatGPT app.
5. Bind issuer, new app audience and allowlisted email via approved, protected Worker config. Deploy exact tested main SHA through authorized workflow with `--keep-vars` and rollback target, preserving D1 and scheduled triggers. Never replace the existing production `AGENTZ_MCP_TOKEN`.
6. Verify anonymous discovery fails closed, OAuth login works, client token maps to signed Access JWT, founder can read tools, arbitrary other users and wrong audience are rejected, and the queue tool denies OAuth users.
7. In an eligible ChatGPT **web** workspace, open Plugins → + → Add custom MCP server, enter the new dedicated MCP URL, choose OAuth, acknowledge the risk warning, and discover tools. OAuth authorization requires a genuine browser sign-in from the user; neither an assistant nor the repository can secretly complete that user-consent step.
8. Install the resulting plugin and test an authorized `agentz_readiness` call. Custom MCP availability and publication depend on ChatGPT plan and workspace permissions; mobile clients do not currently support installing custom MCP apps.

## Non-goals and release constraints

This OAuth integration is not a browser automation agent, native test runner, independent security reviewer, payment executor or production release bypass. It grants no generic chat the ability to run CI, modify code, deploy or charge. Preserve `humanHold`, `production_send=false`, existing immutable deployment evidence, $0 discretionary spending, customer privacy and all enforced GitHub protections.

If Access Managed OAuth or a new Access app would incur additional charges, stop before enabling it and get explicit approval. The existing project account identity policy is not a substitute for per-user token validation at the MCP resource server.
