# AuthiChain Trust Engine — MCP Server

The verification/trust layer for the agentic economy. Any AI agent (Claude, Cursor,
or an autonomous "business OS") can call AuthiChain to verify authenticity, classify a
product, and **pay per verification via x402** — no human in the loop at runtime.

## Run

```bash
npx tsx server/mcp/index.ts
```

Add to an MCP client (`.mcp.json` / client config):

```json
{
  "mcpServers": {
    "authichain": { "command": "npx", "args": ["tsx", "server/mcp/index.ts"] }
  }
}
```

## Tools

| Tool                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `verify_authenticity`   | Verify a product by certificate number           |
| `classify_product`      | Map a product to an industry vertical + workflow |
| `verify_sovereign_deal` | Verify a sovereign deal by TrueMark ID           |
| `mint_certificate`      | Initiate a trust certificate mint                |
| `get_pricing`           | Discover metered price + subscription plans      |
| `verify_paid`           | **Pay-per-call** verification via x402           |

## Autonomous micropayments (x402)

High-volume agents use the metered HTTP endpoint **`POST /api/v1/agent-verify`**:

1. Discover live price/payTo: `GET https://authichain.com/api/x402/catalog` (or `/api/x402/health`).
2. Call `POST /api/x402` with no payment → `HTTP 402` + payment requirements (x402, $0.05 Circle USDC on Base).
3. The agent wallet pays the published `payTo` and retries with an `X-PAYMENT` proof header.
4. The edge verifies settlement (PayAI facilitator). Daily cap $10 / payer.

Do not rebind `X402_PAY_TO`, the facilitator, or the USDC asset. `$QRON` is not the unit of account.
Canonical economics: `docs/strategy/AGENT_TOKENOMICS_x402.md`. HTML: `https://authichain.com/x402`.

## Publishing

This server is registry-ready (`manifest.json`). Submit to MCP registries (Smithery,
the public MCP registry, agent tool directories) to make AuthiChain verification
discoverable to the agent ecosystem.
