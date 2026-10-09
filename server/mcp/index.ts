import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { agentPricingDiscovery } from "../../src/lib/authentic-economy";

/**
 * AuthiChain MCP Server
 * Exposes our trust engine to the global AI agent ecosystem.
 */
const server = new McpServer({
  name: "AuthiChain Trust Engine",
  version: "1.0.0",
});

// The four tools below are in development. Their replies must never read as a
// verdict: no authenticity status, no blockchain/minting status, no origin or
// country-of-origin claim and no confidence value (PM-348, ADM-114, RES-106).
// Tool names and input schemas stay as they are so agent clients don't break.
export const STUB_TOOL_REPLY =
  "Not available yet: this tool returns no verification result.";

export const STUB_TOOL_NAMES = [
  "verify_authenticity",
  "mint_certificate",
  "classify_product",
  "verify_sovereign_deal",
] as const;

export function stubToolReply() {
  return {
    content: [{ type: "text" as const, text: STUB_TOOL_REPLY }],
  };
}

// Tool: Verify Authenticity (in development, no verdict)
server.tool(
  "verify_authenticity",
  {
    certificateNumber: z
      .string()
      .describe("The unique AuthiChain certificate ID"),
  },
  async () => stubToolReply()
);

// Tool: Mint Trust Certificate (in development, no verdict)
server.tool(
  "mint_certificate",
  {
    productId: z.number(),
    userId: z.number(),
    bountyAmount: z
      .number()
      .optional()
      .describe(
        "Optional speculative $QRON trust bounty (not x402 settlement; $QRON is not a payment rail)"
      ),
  },
  async () => stubToolReply()
);

// Tool: Classify Product Vertical (in development, no verdict)
server.tool(
  "classify_product",
  {
    name: z.string().describe("Name of the product"),
    description: z
      .string()
      .optional()
      .describe("Description or physical attributes"),
  },
  async () => stubToolReply()
);

// Tool: Verify Sovereign Deal (in development, no verdict, no origin field)
server.tool(
  "verify_sovereign_deal",
  {
    truemarkId: z.string().describe("The TrueMark ID of the deal to verify"),
  },
  async () => stubToolReply()
);

// Tool: Get pricing (lets autonomous agents discover what they can buy + the metered API)
server.tool("get_pricing", {}, async () => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(agentPricingDiscovery(), null, 2),
    },
  ],
}));

// Tool: Paid autonomous verification via x402 (agent pays per call)
server.tool(
  "verify_paid",
  {
    subject: z
      .string()
      .describe("Product ID, serial, or certificate to verify"),
    payment: z
      .string()
      .optional()
      .describe(
        "Base64-encoded x402 X-PAYMENT proof. Omit to receive payment requirements."
      ),
  },
  async ({ subject, payment }) => {
    if (!payment) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: 402,
              x402Version: 2,
              message: "Payment required for metered verification.",
              pay: {
                endpoint: "POST /api/v1/agent-verify",
                network: "base",
                chainId: "8453",
                amount: "$0.05 USDC",
                catalog: "https://authichain.com/api/x402/catalog",
                identity:
                  "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md",
              },
              then:
                'Retry POST /api/v1/agent-verify with header X-PAYMENT: <base64 proof> and body { productId: "' +
                subject +
                '" }.',
            }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Payment proof received for "${subject}". Submit POST /api/v1/agent-verify (header X-PAYMENT) for settlement + a 0-100 authenticity score.`,
        },
      ],
    };
  }
);

export { server as mcpServer };

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[MCP] AuthiChain Protocol server running via stdio");
}
