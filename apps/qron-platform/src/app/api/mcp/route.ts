import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth-api';
import { logAutomation } from '@/lib/automation';

/**
 * MCP ENDPOINT (Model Context Protocol)
 * Implements the "Stripe for Product Authentication" AI distribution layer.
 * Pulled from AuthiChain2026/authichain-mcp-server
 */

const AUTHICHAIN_CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const QRON_TOKEN = "0xAebfA6b08fb25b59748c93273aB8880e20FfE437";

// verify / check_eu_dpp / register are in development. Their replies must not
// read as a verdict (no SECURED status, no consensus count, no compliance
// status or emissions figures, no on-chain claim). PM-348, ADM-114, RES-106.
const STUB_TOOL_REPLY =
  "Not available yet: this tool returns no verification result.";

const TOOLS = [
  {
    name: "authichain_verify_product",
    description: "Verifies product authenticity using a 5-agent AI consensus mechanism. Requires a serial number.",
    inputSchema: {
      type: "object",
      properties: {
        serial: { type: "string", description: "The product serial number or Ed25519 hash" }
      },
      required: ["serial"]
    }
  },
  {
    name: "authichain_register_product",
    description: "Registers a new product in the registry and mints a corresponding NFT certificate on Polygon.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        manufacturer: { type: "string" },
        target_url: { type: "string" }
      },
      required: ["name", "manufacturer", "target_url"]
    }
  },
  {
    name: "authichain_check_eu_dpp",
    description: "Validates product compliance with EU Digital Product Passport (DPP) standards.",
    inputSchema: {
      type: "object",
      properties: {
        certification_id: { type: "string" }
      },
      required: ["certification_id"]
    }
  },
  {
    name: "authichain_get_pricing",
    description: "Retrieves the current API pricing tiers and discovery information.",
    inputSchema: { type: "object", properties: {} }
  }
];

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-API-Key');
    const { method, params } = await req.json();

    // 1. Handle listTools
    if (method === "notifications/initialized" || method === "initialize") {
        return NextResponse.json({
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "authichain-mcp-server", version: "1.0.0" }
        });
    }

    if (method === "tools/list") {
      return NextResponse.json({ tools: TOOLS });
    }

    // 2. Handle callTool (requires authentication; placeholder tools are not billed)
    if (method === "tools/call") {
      if (!apiKey) {
        return NextResponse.json({ error: "X-API-Key required for tool execution" }, { status: 401 });
      }

      const userId = await verifyApiKey(apiKey);
      if (!userId) {
        return NextResponse.json({ error: "Invalid or inactive API Key" }, { status: 401 });
      }

      const { name, arguments: args } = params;

      switch (name) {
        case "authichain_get_pricing":
          return NextResponse.json({
            content: [{
              type: "text",
              text: JSON.stringify({
                verify_product: "$0.05",
                register_product: "$0.50",
                check_eu_dpp: "$5.00",
                network: "Polygon POS",
                contract: AUTHICHAIN_CONTRACT,
                token: QRON_TOKEN
              }, null, 2)
            }]
          });

        case "authichain_verify_product":
          // No billing: this tool is a placeholder and returns no result
          // (PM-348). Do not call reportAgentUsage until it does real work.
          return NextResponse.json({
            content: [{
              type: "text",
              text: STUB_TOOL_REPLY
            }]
          });

        case "authichain_check_eu_dpp":
          // No billing: this tool is a placeholder and returns no result
          // (PM-348). Do not call reportAgentUsage until it does real work.
          return NextResponse.json({
            content: [{
              type: "text",
              text: STUB_TOOL_REPLY
            }]
          });

        case "authichain_register_product":
          // No billing: this tool is a placeholder and returns no result
          // (PM-348). Do not call reportAgentUsage until it does real work.
          return NextResponse.json({
            content: [{
              type: "text",
              text: STUB_TOOL_REPLY
            }]
          });

        default:
          return NextResponse.json({ error: `Tool ${name} not implemented` }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Method not found" }, { status: 404 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[MCP] Execution error:', err);
    await logAutomation('mcp', 'event', 'failure', null, msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
