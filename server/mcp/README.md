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

| Tool | Purpose |
|---|---|
| `verify_authenticity` | Verify a product by certificate number |
| `classify_product` | Map a product to an industry vertical + workflow |
| `verify_sovereign_deal` | Verify a sovereign deal by TrueMark ID |
| `mint_certificate` | Initiate a trust certificate mint |
| `get_pricing` | Discover metered price + subscription plans |
| `verify_paid` | **Pay-per-call** verification via x402 |

## Autonomous micropayments (x402)

High-volume agents use the metered HTTP endpoint **`POST /api/v1/agent-verify`**:

1. Call with no payment → `HTTP 402` + payment requirements (x402, $0.05 USDC on Polygon).
2. The agent wallet pays and retries with an `X-PAYMENT` proof header.
3. The server verifies the payment, enforces a **per-payer daily spend cap + rate limit**,
   then returns a 0–100 authenticity score.

Settlement runs in dev/structural mode until `X402_FACILITATOR_URL` is set; a KYC'd entity
must fund and own `X402_PAY_TO`. See `docs/agentic-economy-strategy.md`.

## Publishing

This server is registry-ready (`manifest.json`). Submit to MCP registries (Smithery,
the public MCP registry, agent tool directories) to make AuthiChain verification
discoverable to the agent ecosystem.
