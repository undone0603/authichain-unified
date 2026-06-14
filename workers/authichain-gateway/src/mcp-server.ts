import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Env } from "./index";

/**
 * MCP Server for ChatGPT Apps SDK integration.
 * Exposes AuthiChain verification tools via Streamable HTTP transport.
 */

function mcpError(e: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
}

function createMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: "AuthiChain",
    version: "2.0.0",
  });

  // ─── Tool: verify_product ───────────────────────────────────────────────────
  server.tool(
    "verify_product",
    "Verify the authenticity of a physical product using AuthiChain's 5-agent AI consensus protocol. Returns trust score, verification status, and provenance data.",
    {
      productId: z.string().optional().describe("Product ID or serial number"),
      imageUrl: z.string().optional().describe("URL of product image for visual verification"),
      barcode: z.string().optional().describe("Barcode or QR code data"),
      metadata: z.record(z.string()).optional().describe("Additional product metadata"),
    },
    async ({ productId, imageUrl, barcode, metadata }) => {
      try {
        const res = await fetch(`${env.BACKEND_URL}/api/internal/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": env.INTERNAL_SECRET },
          body: JSON.stringify({ productId, imageUrl, barcode, metadata }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: generate_qr_art ─────────────────────────────────────────────────
  server.tool(
    "generate_qr_art",
    "Generate an artistic AI-powered QRON code that encodes verification data while being visually stunning. 11 style modes available.",
    {
      data: z.string().describe("Data to encode in the QR code (URL, product ID, or text)"),
      style: z.enum([
        "cosmic_nebula", "cyberpunk", "watercolor", "holographic_mosaic",
        "teal_pulse", "medieval_fantasy", "anime_manga", "architectural",
        "echo_qr", "video_qr", "phantom_qr",
      ]).optional().describe("Art style for the QRON code"),
      prompt: z.string().optional().describe("Custom art prompt for the QR background"),
    },
    async ({ data, style, prompt }) => {
      try {
        const res = await fetch(`${env.BACKEND_URL}/api/internal/qr/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": env.INTERNAL_SECRET },
          body: JSON.stringify({ data, style: style || "cosmic_nebula", prompt }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: check_certificate ────────────────────────────────────────────────
  server.tool(
    "check_certificate",
    "Look up an AuthiChain verification certificate by its certificate number. Returns the full provenance chain and verification history.",
    {
      certificateNumber: z.string().describe("Certificate number (e.g., AC-2026-XXXX)"),
    },
    async ({ certificateNumber }) => {
      try {
        const res = await fetch(
          `${env.BACKEND_URL}/api/internal/certificates/verify?certNumber=${encodeURIComponent(certificateNumber)}`,
          { headers: { "X-Internal-Secret": env.INTERNAL_SECRET } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: verify_cannabis_strain ───────────────────────────────────────────
  server.tool(
    "verify_cannabis_strain",
    "Verify a cannabis strain's authenticity using StrainChain. Checks genetics, terpene profile, lab results, and METRC compliance.",
    {
      strainName: z.string().describe("Name of the cannabis strain"),
      batchId: z.string().optional().describe("Batch or lot number from packaging"),
      labCertHash: z.string().optional().describe("SHA-256 hash of the lab certificate"),
      thcPercent: z.number().optional().describe("Claimed THC percentage"),
      cbdPercent: z.number().optional().describe("Claimed CBD percentage"),
    },
    async ({ strainName, batchId, labCertHash, thcPercent, cbdPercent }) => {
      try {
        const res = await fetch(`${env.BACKEND_URL}/api/internal/cannabis/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": env.INTERNAL_SECRET },
          body: JSON.stringify({ strainName, batchId, labCertHash, thcPercent, cbdPercent }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: compute_trust_score ──────────────────────────────────────────────
  server.tool(
    "compute_trust_score",
    "Compute a composite trust score for a product based on multiple verification signals (QR decode, blockchain cert, NFC, visual match, geo-fence).",
    {
      qrDecodePass: z.boolean().describe("Whether QR code decoded successfully"),
      blockchainCertExists: z.boolean().describe("Whether blockchain certificate exists"),
      nfcMatch: z.boolean().optional().describe("Whether NFC chip data matches"),
      visualMatch: z.number().min(0).max(100).optional().describe("Visual similarity score (0-100)"),
      geoFenceOk: z.boolean().optional().describe("Whether scan location is within expected geo-fence"),
    },
    async ({ qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk }) => {
      try {
        const res = await fetch(`${env.BACKEND_URL}/api/internal/trust-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": env.INTERNAL_SECRET },
          body: JSON.stringify({ qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: register_product ─────────────────────────────────────────────────
  server.tool(
    "register_product",
    "Register a new product in the AuthiChain verification network. Creates a blockchain-anchored record with provenance metadata.",
    {
      name: z.string().describe("Product name"),
      manufacturer: z.string().describe("Manufacturer or brand name"),
      serialNumber: z.string().optional().describe("Serial or SKU number"),
      category: z.string().optional().describe("Product category"),
      metadata: z.record(z.string()).optional().describe("Additional product metadata"),
    },
    async ({ name, manufacturer, serialNumber, category, metadata }) => {
      try {
        const res = await fetch(`${env.BACKEND_URL}/api/internal/products/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": env.INTERNAL_SECRET },
          body: JSON.stringify({ name, manufacturer, serialNumber, category, metadata }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  // ─── Tool: get_verification_analytics ───────────────────────────────────────
  server.tool(
    "get_verification_analytics",
    "Get verification analytics and usage statistics. Shows scan counts, authenticity rates, top products, and geographic distribution.",
    {
      period: z.enum(["today", "week", "month", "quarter"]).optional().describe("Time period for analytics"),
      productId: z.string().optional().describe("Filter by specific product ID"),
    },
    async ({ period, productId }) => {
      try {
        const params = new URLSearchParams();
        if (period) params.set("period", period);
        if (productId) params.set("productId", productId);
        const res = await fetch(
          `${env.BACKEND_URL}/api/internal/analytics?${params.toString()}`,
          { headers: { "X-Internal-Secret": env.INTERNAL_SECRET } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return mcpError(e); }
    },
  );

  return server;
}

/**
 * Handle MCP requests via Web Standard Streamable HTTP transport.
 * Stateless mode (no session management) for Cloudflare Workers.
 */
export async function handleMcp(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const server = createMcpServer(env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true,
  });

  await server.connect(transport);

  return transport.handleRequest(request);
}
