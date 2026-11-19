# AuthiChain Hosted MCP Server

Connect AI agents and developer tools to AuthiChain's hosted Model Context Protocol (MCP) endpoint at `https://authichain.com/mcp` (one-click installer: `https://authichain.com/mcp/install`).

## Overview

The AuthiChain MCP server exposes product provenance, Digital Product Passport (DPP) readiness, Living QR inspection, and cryptographic verification tools over Streamable HTTP.

It distinguishes between two verification levels:
- **Signed verification**: Cryptographic validation of signed attestations and records (`verify_attestation`, `verify_record`, and paid `verify` evidence).
- **Registry lookup**: Querying registered provenance timelines, QRON metadata, and DPP readiness (`query_provenance`, `dpp_readiness_check`, `scan_living_qr`).

## Quickstart

Use the hosted HTTP endpoint directly—no Docker, no local database, and no `DATABASE_URL` required:

- **MCP Endpoint**: `https://authichain.com/mcp`
- **One-Click Install**: `https://authichain.com/mcp/install`

## Claude Code

Add via CLI:

```bash
claude mcp add --transport http authichain https://authichain.com/mcp
```

Or add to your `.mcp.json` / Claude configuration:

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

## Cursor

Use the one-click deeplink: [Install in Cursor](https://authichain.com/mcp/install)

Or add to `.cursor/mcp.json`:

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

## VS Code

Add via CLI:

```bash
code --add-mcp '{"name":"authichain","type":"http","url":"https://authichain.com/mcp"}'
```

Or add to `.vscode/mcp.json` using the `servers` format:

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

## Generic MCP Client

Minimal HTTP configuration for any MCP-compatible client:

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

## Available Tools

The hosted server (`workers/authichain-com/src/mcp-routes.ts`) exposes 8 tools:

1. `get_pricing` — Returns current free and paid x402 verification pricing tiers.
2. `verify` — Performs product verification against AuthiChain trust and provenance records.
3. `query_provenance` — Retrieves registered product provenance history and supply-chain events.
4. `verify_attestation` — Verifies cryptographic signatures and issuer claims on an attestation.
5. `verify_record` — Validates a signed verification record without requiring payment.
6. `dpp_readiness_check` — Evaluates Digital Product Passport (DPP) completeness and compliance readiness.
7. `scan_living_qr` — Inspects a Living QR / QRON identifier and its dynamic state.
8. `negotiate` — Negotiates verification scope, tier selection, and x402 payment terms.

## Free Verification

You can call free tools such as `get_pricing` and `verify_record` directly via JSON-RPC over HTTP POST (see also `mcp/examples/hosted-quickstart.mjs`):

```bash
curl -sS -X POST https://authichain.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_pricing",
      "arguments": {}
    }
  }'
```

Example `verify_record` call:

```bash
curl -sS -X POST https://authichain.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "verify_record",
      "arguments": {
        "id": "polygon-anchor-1"
      }
    }
  }'
```

## Paid Verification

Paid verification endpoints use separately authorized **x402** payments in **Base USDC** via the `PAYMENT-SIGNATURE` request header:

- `ping`: **$0.01** USDC
- `verify`: **$0.05** USDC
- `evidence`: **$0.10** USDC

Unpaid requests to paid tiers return an HTTP `402 Payment Required` challenge describing the required x402 payment payload.

## Security

- Public hosted users do **not** need `DATABASE_URL`, private keys, or internal AuthiChain credentials.
- Only include a `PAYMENT-SIGNATURE` header when intentionally authorizing a paid x402 Base USDC call.
- A registry match alone confirms that an identifier exists in the registry—it does **not** by itself prove physical authenticity without signed cryptographic attestation and physical inspection.

## Troubleshooting

- **HTTP / CORS errors**: Ensure requests target `https://authichain.com/mcp` with `Content-Type: application/json` and `Accept: application/json, text/event-stream`.
- **`MCP-Protocol-Version` header**: Supported protocol versions are `2025-06-18`, `2025-03-26`, and `2024-11-05`. If a client fails negotiation, verify it sends one of these versions.
- **HTTP `405` on SSE stream (`GET`)**: The hosted endpoint uses stateless JSON-RPC `POST` requests; a `405 Method Not Allowed` on `GET /mcp` indicates SSE streaming is not enabled on that route and your client should use standard `POST` transport.
- **Network checks**: Verify outbound HTTPS access to `authichain.com` (`curl -I https://authichain.com/mcp`) and confirm no proxy or firewall strips `MCP-Protocol-Version` or `PAYMENT-SIGNATURE` headers.
