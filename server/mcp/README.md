# AuthiChain MCP

Use `server/mcp/api.ts` for the public API. It calls `https://authichain.com`.
It does not mint certificates and it does not create API keys.

```bash
AUTHICHAIN_API_KEY=ac_live_... npx tsx server/mcp/api.ts
```

```json
{
  "mcpServers": {
    "authichain-api": {
      "command": "npx",
      "args": ["-y", "tsx", "server/mcp/api.ts"],
      "env": {
        "AUTHICHAIN_API_BASE": "https://authichain.com",
        "AUTHICHAIN_API_KEY": "${AUTHICHAIN_API_KEY}"
      }
    }
  }
}
```

Create one free key with `POST /api/v1/keys/create` and `{"email":"<work email>"}`.
Store it in the environment. The free meter is 10 requests an hour.

| Tool | HTTP |
| --- | --- |
| `get_pricing` | `GET /api/v1/pricing` |
| `list_industries` | `GET /api/v1/industries` |
| `verify` | `POST /api/v1/verify` |
| `classify` | `POST /api/v1/classify` |
| `list_products` | `GET /api/v1/products` |
| `whoami` | `GET /api/v1/me` |
| `verify_paid` | `POST /api/x402` |

`verify_paid` does not send the API key. Omit `payment` and the API returns 402 with the live price and `payTo`. Do not set a new pay-to address. `$QRON` is not that payment.

## Local trust-engine server

`server/mcp/index.ts` reads the local database. It is not the public API. Do not register it as the agent-facing server. Its verify and mint replies are not a certificate.

## Local tools

These are the local database tools. They are not the public API.

| Tool                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `verify_authenticity`   | Verify a product by certificate number           |
| `classify_product`      | Map a product to an industry vertical + workflow |
| `verify_sovereign_deal` | Verify a sovereign deal by TrueMark ID           |
| `mint_certificate`      | Initiate a trust certificate mint                |
| `get_pricing`           | Discover metered price + Stripe SKUs (`src/lib/authentic-economy.ts` `agentPricingDiscovery`) |

| `verify_paid`           | **Pay-per-call** verification via x402           |

## Autonomous micropayments (x402)

High-volume agents use the metered HTTP endpoint **`POST /api/v1/agent-verify`**:

1. Discover live price/payTo: `GET https://authichain.com/api/x402/catalog` (or `/api/x402/health`).
2. Call `POST /api/x402` with no payment → `HTTP 402` + payment requirements (x402, $0.05 Circle USDC on Base).
3. The agent wallet pays the published `payTo` and retries with an `X-PAYMENT` proof header.
4. The edge verifies settlement (PayAI facilitator). Daily cap $10 / payer.

Do not rebind `X402_PAY_TO`, the facilitator, or the USDC asset. `$QRON` is not the unit of account.
Canonical economics: `docs/strategy/AGENT_TOKENOMICS_x402.md`. Identity (wallets vs rails): `docs/strategy/WEB3_IDENTITY.md`. HTML: `https://authichain.com/x402`.

## Publishing

This server is registry-ready (`manifest.json`). Submit to MCP registries (Smithery,
the public MCP registry, agent tool directories) to make AuthiChain verification
discoverable to the agent ecosystem.
