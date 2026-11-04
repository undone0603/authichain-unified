# MCP + A2A setup offers and connections

**Status: public connection kit proposed on a review branch.** Not merged/deployed until CI, independent review and protected release. No third-party account is linked by publishing this file.

## Reuse rather than fork

AuthiChain's public MCP server is `https://authichain.com/mcp`. It exposes free tools including `verify_record`; the separate paid `verify` tool may return x402 HTTP 402. Installing a client or fetching tool lists **does not** incur x402 payment. The public A2A 1.0 Agent Card is `https://authichain.com/.well-known/agent-card.json`; its JSON-RPC interface is `https://authichain.com/api/a2a`. A2A card discovery does **not** grant permission to message an external peer or transact.

Official protocol references: MCP Streamable HTTP 2025-11-25 transport (https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), A2A 1.0 discovery (https://a2a-protocol.org/v1.0.0/specification). This repo's MCP server currently negotiates **2025-06-18 / 2025-03-26**; do not claim 2025-11-25 conformance until it passes a formal validation.

### Available service offers

| ID | Offer | Price/status | Definition of completion |
| --- | --- | --- | --- |
| `mcp-self-connect` | Public MCP install | **Free** | Customer client initializes and lists tools without credentials |
| `mcp-assisted-setup` | Assisted MCP connection and permissions | **Quote only** | Written client config, scoped access and read-only preflight accepted |
| `a2a-peer-onboarding` | A2A Agent Card / peer interoperability review | **Quote only** | Approved peer card, compatible transport, sandbox task evidence and signed-off trust policy |

No Stripe price, Payment Link, or invoice exists for the quoted setup offers; collect a written scope and permission first. Do not transform an existing unrelated $29/$49/$299 price into a setup product. The setup offer is not a claimed independent verification, a purchase, or a signed passport.

### MCP client configurations

Claude Code:

```sh
claude mcp add --transport http authichain https://authichain.com/mcp
```

Cursor and compatible `mcpServers` clients:

```json
{
  "mcpServers": {
    "authichain": {
      "type": "http",
      "url": "https://authichain.com/mcp"
    }
  }
}
```

VS Code `.vscode/mcp.json`:

```json
{
  "servers": {
    "authichain": {
      "type": "http",
      "url": "https://authichain.com/mcp"
    }
  }
}
```

The public `/mcp/install` page shows both exact config shapes. Nothing requires local Postgres access, production API credentials or a new wallet.

### A2A peer setup

1. Obtain the other peer owner's authorization and expected HTTPS domain; **do not** submit their private URL to a public directory.
2. Read their Agent Card from `https://<authorized-peer>/.well-known/agent-card.json` using a trusted client. For arbitrary peers, validate DNS/redirects/egress against an explicit operator allowlist, not an unaudited fetch from the public Worker.
3. Inspect `supportedInterfaces` (prefer the first supported transport), `skills`, `capabilities`, `securitySchemes` and exact issuer/domain ownership. Reject undeclared protocol versions; never infer identity from an untrusted card alone.
   Before any live peer call, validate an authorized local card offline:

   ```sh
   node --test tools/agent-connections/peer-card.test.mjs
   node tools/agent-connections/peer-card.mjs ./authorized-peer-card.json https://peer.example/
   ```

   This report always returns `connected: false`. A matching origin and interface are only compatibility evidence, not a trust grant.

4. Confirm authentication and task limits in a written approval. Use a sandbox and the real A2A 1.0 client for non-financial `SendMessage` only **after** peer approval. Do not attach production tokens to a sample card or send task payloads to unreviewed URLs.
5. Record successful negotiation, request/response test and revocation instructions. A connected peer is not a verified payment, customer or product, and no live settlements or outbound messages are initiated by this kit.

### Run the first-party read-only preflight

```sh
node --test tools/agent-connections/probe.test.mjs
node tools/agent-connections/probe.mjs
```

The CLI connects only to **AuthiChain's fixed public endpoints**. It sends MCP `initialize` and `tools/list`, then fetches the A2A Agent Card. It never sends `tools/call`, A2A `SendMessage`, a payment header, wallet signature or secret. Its result distinguishes `compatible`, `review_required` and any transport error. A successful result confirms endpoint compatibility, **not** an authorized third-party connection.

### Assisted integration intake / commercial delivery

Private intake should establish buyer identity, owner-approved peer endpoints and scopes, supported clients, audit and revocation needs, any environment/network restrictions, a written non-cannabis/general-purpose service scope, and explicit pricing approval. Provide an operator-reviewed draft, test transcript from authorized environment, and customer's acceptance. Use `hello@authichain.com` for initial quote requests; never collect access tokens in a public form or email.

Keep `production_send=false`, `humanHold`, runtime issuer controls, per-agent budgets and permissions. Do not add setup offers to Stripe or x402 until pricing, tax/account policy and signed fulfillment conditions are approved. The quotation tool is read-only and cannot contract, bill or activate connections.
