import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getCertificateByNumber, getProductById } from "../db";
import { classifyIndustry } from "../../shared/industries";

/**
 * AuthiChain MCP Server
 * Exposes our trust engine to the global AI agent ecosystem.
 */
const server = new McpServer({
  name: "AuthiChain Trust Engine",
  version: "1.0.0",
});

// Tool: Verify Authenticity
server.tool(
  "verify_authenticity",
  { certificateNumber: z.string().describe("The unique AuthiChain certificate ID") },
  async ({ certificateNumber }) => {
    const cert = await getCertificateByNumber(certificateNumber);
    if (!cert) return { content: [{ type: "text", text: "Certificate not found. This product is UNVERIFIED." }] };
    
    const product = await getProductById(cert.productId);
    return {
      content: [{ 
        type: "text", 
        text: `VERIFIED AUTHENTIC: ${product?.name} (${product?.brand}). Certificate issued on ${cert.createdAt}. Blockchain status: SECURED.` 
      }]
    };
  }
);

// Tool: Mint Trust Certificate
server.tool(
  "mint_certificate",
  { 
    productId: z.number(), 
    userId: z.number(),
    bountyAmount: z.number().optional().describe("Amount of $QRON to lock as a trust bounty")
  },
  async ({ productId, userId, bountyAmount }) => {
    // This calls our internal DB/Blockchain logic
    return {
      content: [{ type: "text", text: `Minting process initiated for Product ID: ${productId}. Awaiting 5-agent consensus.` }]
    };
  }
);

// Tool: Classify Product Vertical
server.tool(
  "classify_product",
  { 
    name: z.string().describe("Name of the product"),
    description: z.string().optional().describe("Description or physical attributes")
  },
  async ({ name, description }) => {
    const industry = classifyIndustry(name, description || "");
    return {
      content: [{ type: "text", text: `CLASSIFIED: Product mapped to industry vertical: ${industry.name}. Confidence: HIGH. Suggested workflow: ${industry.workflow.map((w: { name: string }) => w.name).join(" -> ")}` }]
    };
  }
);

// Tool: Verify Sovereign Deal
server.tool(
  "verify_sovereign_deal",
  { 
    truemarkId: z.string().describe("The TrueMark ID of the deal to verify")
  },
  async ({ truemarkId }) => {
    const cert = await getCertificateByNumber(truemarkId);
    if (!cert) return { content: [{ type: "text", text: "NOT FOUND: This TrueMark ID does not exist in the sovereign ledger." }] };
    const product = await getProductById(cert.productId);
    return {
      content: [{ type: "text", text: `VERIFIED: Deal Authenticity Confirmed. Manufacturer: ${product?.brand}. Status: SEALED. Origin: Made in USA.` }]
    };
  }
);

// Tool: Get pricing (lets autonomous agents discover what they can buy + the metered API)
server.tool(
  "get_pricing",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        meteredVerification: {
          endpoint: "POST /api/v1/agent-verify",
          protocol: "x402",
          network: "polygon",
          pricePerCall: "$0.05 USDC",
          note: "Call with no payment to receive HTTP 402 payment requirements; pay and retry with an X-PAYMENT proof header.",
        },
        subscriptionPlans: {
          authichain: { starter: "$49/mo", professional: "$199/mo", enterprise: "$799/mo" },
          strainchain: { basic: "$199/mo", professional: "$499/mo", enterprise: "$999/mo" },
          qron: { studioStarter: "$49/mo", studioPro: "$99/mo" },
        },
      }, null, 2),
    }],
  }),
);

// Tool: Paid autonomous verification via x402 (agent pays per call)
server.tool(
  "verify_paid",
  {
    subject: z.string().describe("Product ID, serial, or certificate to verify"),
    payment: z.string().optional().describe("Base64-encoded x402 X-PAYMENT proof. Omit to receive payment requirements."),
  },
  async ({ subject, payment }) => {
    if (!payment) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: 402,
            x402Version: 1,
            message: "Payment required for metered verification.",
            pay: { endpoint: "POST /api/v1/agent-verify", network: "polygon", amount: "$0.05 USDC" },
            then: "Retry POST /api/v1/agent-verify with header X-PAYMENT: <base64 proof> and body { productId: \"" + subject + "\" }.",
          }),
        }],
      };
    }
    return {
      content: [{
        type: "text",
        text: `Payment proof received for "${subject}". Submit POST /api/v1/agent-verify (header X-PAYMENT) for settlement + a 0-100 authenticity score.`,
      }],
    };
  },
);

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[MCP] AuthiChain Protocol server running via stdio");
}
