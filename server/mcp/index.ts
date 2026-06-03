import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// AUTHICHAIN MCP SERVER — Product Authentication API for AI Agents
// Monetization: Every tool call = billable API event via Stripe
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.AUTHICHAIN_API_URL || "https://authichain-api.authichain2026.workers.dev";
const API_KEY = process.env.AUTHICHAIN_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://nhdnkzhtadfkkluiulhs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

// ─── API Client ───────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: Record<string, unknown>,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "User-Agent": "authichain-mcp-server/1.0.0",
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`AuthiChain API error (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<T>;
}

async function supabaseQuery<T>(
  table: string,
  query: string = "",
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": method === "POST" ? "return=representation" : "count=exact",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Supabase error (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Server Initialization ────────────────────────────────────

const server = new McpServer({
  name: "authichain-mcp-server",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════
// TOOL 1: Verify Product Authenticity
// Revenue: $0.01–0.05 per verification call
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_verify_product",
  {
    title: "Verify Product Authenticity",
    description: `Verify the authenticity of a product using AuthiChain's 5-agent AI consensus system (Truth Network).

Returns a trust score (0-100), consensus verdict, and individual agent assessments from:
- Guardian (35% weight): Primary authentication analysis
- Archivist (20%): Historical record verification
- Sentinel (25%): Anomaly and fraud detection
- Scout (8%): Market intelligence cross-reference
- Arbiter (12%): Final consensus arbitration

Args:
  - product_id (string): AuthiChain product ID, blockchain certificate hash, or QR code payload
  - include_history (boolean): Include full scan and verification history (default: false)

Returns: Trust score, consensus verdict, agent assessments, blockchain certificate status, and optionally scan history.

Use when: A user asks "Is this product authentic?", "Verify this item", or needs to check product provenance.`,
    inputSchema: {
      product_id: z.string().min(1).describe("Product ID, certificate hash, or QR code payload"),
      include_history: z.boolean().default(false).describe("Include full scan/verification history"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ product_id, include_history }) => {
    try {
      const result = await apiRequest<any>("verify", "POST", {
        product_id,
        include_history,
        source: "mcp",
      });

      const output = {
        product_id,
        trust_score: result.trust_score ?? 0,
        verdict: result.verdict ?? "UNKNOWN",
        blockchain_verified: result.blockchain_verified ?? false,
        certificate_hash: result.certificate_hash ?? null,
        agents: result.agents ?? {
          guardian: { score: 0, assessment: "No data" },
          archivist: { score: 0, assessment: "No data" },
          sentinel: { score: 0, assessment: "No data" },
          scout: { score: 0, assessment: "No data" },
          arbiter: { score: 0, assessment: "No data" },
        },
        scan_count: result.scan_count ?? 0,
        last_scanned: result.last_scanned ?? null,
        ...(include_history ? { history: result.history ?? [] } : {}),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Verification failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 2: Register Product
// Revenue: $0.10–1.00 per registration
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_register_product",
  {
    title: "Register Product for Authentication",
    description: `Register a new product in the AuthiChain authentication network. Creates a blockchain certificate on Polygon and generates a unique QR code for verification.

Args:
  - name (string): Product name
  - brand (string): Brand or manufacturer name
  - category (string): Product category (e.g., 'cannabis', 'luxury', 'electronics', 'pharma', 'textile', 'food')
  - description (string): Product description
  - metadata (object, optional): Additional product metadata (batch, serial, origin, etc.)
  - mint_nft (boolean): Whether to mint an NFT certificate on Polygon (default: true)
  - generate_qr (boolean): Whether to generate a QRON QR code (default: true)

Returns: Product ID, certificate hash, QR code URL, and blockchain transaction details.

Use when: A brand wants to register a product for authentication, or a user asks to "add a product to AuthiChain".`,
    inputSchema: {
      name: z.string().min(1).max(200).describe("Product name"),
      brand: z.string().min(1).max(100).describe("Brand or manufacturer name"),
      category: z.enum(["cannabis", "luxury", "electronics", "pharma", "textile", "food", "automotive", "other"])
        .describe("Product category"),
      description: z.string().max(1000).default("").describe("Product description"),
      metadata: z.record(z.string(), z.any()).optional().describe("Additional metadata (batch, serial, origin)"),
      mint_nft: z.boolean().default(true).describe("Mint NFT certificate on Polygon"),
      generate_qr: z.boolean().default(true).describe("Generate QRON QR code"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ name, brand, category, description, metadata, mint_nft, generate_qr }) => {
    try {
      const result = await apiRequest<any>("products/register", "POST", {
        name, brand, category, description,
        metadata: metadata ?? {},
        mint_nft, generate_qr,
        source: "mcp",
      });

      const output = {
        product_id: result.product_id,
        certificate_hash: result.certificate_hash ?? null,
        qr_code_url: result.qr_code_url ?? null,
        blockchain_tx: result.blockchain_tx ?? null,
        polygon_contract: "0x4da4D2675e52374639C9c954f4f653887A9972BE",
        status: "registered",
        created_at: new Date().toISOString(),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Registration failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 3: Search Products
// Revenue: $0.01 per search
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_search_products",
  {
    title: "Search Authenticated Products",
    description: `Search the AuthiChain product registry. Find authenticated products by name, brand, category, or metadata.

Args:
  - query (string): Search query (matches name, brand, description)
  - category (string, optional): Filter by category
  - brand (string, optional): Filter by brand name
  - limit (number): Max results (1-50, default: 20)
  - offset (number): Pagination offset (default: 0)

Returns: List of authenticated products with trust scores, certificate status, and scan counts.`,
    inputSchema: {
      query: z.string().min(1).max(200).describe("Search query"),
      category: z.string().optional().describe("Category filter"),
      brand: z.string().optional().describe("Brand filter"),
      limit: z.number().int().min(1).max(50).default(20).describe("Max results"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query, category, brand, limit, offset }) => {
    try {
      const params: Record<string, string> = {
        q: query,
        limit: String(limit),
        offset: String(offset),
      };
      if (category) params.category = category;
      if (brand) params.brand = brand;

      const result = await apiRequest<any>("products/search", "GET", undefined, params);

      const output = {
        total: result.total ?? 0,
        count: result.products?.length ?? 0,
        offset,
        products: (result.products ?? []).map((p: any) => ({
          product_id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          trust_score: p.trust_score ?? 0,
          certificate_hash: p.certificate_hash,
          scan_count: p.scan_count ?? 0,
          verified: p.blockchain_verified ?? false,
        })),
        has_more: (result.total ?? 0) > offset + (result.products?.length ?? 0),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Search failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 4: EU DPP Compliance Check
// Revenue: $0.50–5.00 per compliance check
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_check_eu_dpp",
  {
    title: "Check EU Digital Product Passport Compliance",
    description: `Check whether a product meets EU Digital Product Passport (DPP) requirements under ESPR Regulation (EU) 2024/1781.

The EU DPP is mandatory from February 2027 for batteries, with textiles, electronics, furniture following through 2030. Products without a DPP cannot be sold in the EU market.

AuthiChain evaluates compliance across:
- Material composition & origin data
- Environmental impact / carbon footprint
- Repairability & end-of-life handling
- Supply chain traceability
- QR code data carrier (ESPR Article 10)
- GS1 Digital Link compatibility
- JSON-LD Schema.org structured data

Args:
  - product_id (string): AuthiChain product ID to check
  - category (string): EU DPP product category for sector-specific rules
  - generate_passport (boolean): Generate a compliant DPP document (default: false)

Returns: Compliance score (0-100), missing fields, remediation steps, and optionally a generated DPP document.

Use when: A manufacturer asks about EU compliance, DPP readiness, or needs to generate a Digital Product Passport.`,
    inputSchema: {
      product_id: z.string().min(1).describe("AuthiChain product ID"),
      category: z.enum(["battery", "textile", "electronics", "furniture", "tyre", "steel", "aluminum", "detergent", "other"])
        .describe("EU DPP product category"),
      generate_passport: z.boolean().default(false).describe("Generate compliant DPP document"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ product_id, category, generate_passport }) => {
    try {
      const result = await apiRequest<any>("dpp/check", "POST", {
        product_id, category, generate_passport, source: "mcp",
      });

      const output = {
        product_id,
        category,
        compliance_score: result.compliance_score ?? 0,
        status: result.status ?? "non_compliant",
        eu_deadline: result.eu_deadline ?? "2027-02-18",
        missing_fields: result.missing_fields ?? [],
        remediation_steps: result.remediation_steps ?? [],
        qr_data_carrier: result.qr_data_carrier ?? false,
        gs1_compatible: result.gs1_compatible ?? false,
        json_ld_valid: result.json_ld_valid ?? false,
        ...(generate_passport ? { passport_url: result.passport_url } : {}),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `DPP check failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 5: Truth Network Query
// Revenue: $0.05 per query
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_truth_network",
  {
    title: "Query the AuthiChain Truth Network",
    description: `Query the AuthiChain Truth Network — a 5-agent AI consensus system that evaluates product authenticity using independent analysis from specialized AI agents.

Agents and their roles:
- Guardian (35% consensus weight): Primary authentication engine. Analyzes physical markers, metadata consistency, and provenance claims.
- Archivist (20%): Historical verification. Cross-references product history, ownership chain, and manufacturing records.
- Sentinel (25%): Fraud detection. Pattern matching against known counterfeit signatures, anomaly detection.
- Scout (8%): Market intelligence. Compares against market pricing, availability, and distribution patterns.
- Arbiter (12%): Final consensus. Weighs all agent assessments and produces the final trust score.

Args:
  - query (string): Natural language query about a product or authentication scenario
  - context (object, optional): Additional context (product details, images, certificates)

Returns: Consensus analysis with individual agent assessments and recommendations.

Use when: A user needs expert analysis on product authenticity, supply chain integrity, or counterfeit risk assessment.`,
    inputSchema: {
      query: z.string().min(1).max(2000).describe("Natural language authentication query"),
      context: z.record(z.string(), z.any()).optional().describe("Additional context (product details, images, certs)"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, context }) => {
    try {
      const result = await apiRequest<any>("truth-network/query", "POST", {
        query, context: context ?? {}, source: "mcp",
      });

      const output = {
        query,
        consensus: result.consensus ?? "INCONCLUSIVE",
        confidence: result.confidence ?? 0,
        analysis: result.analysis ?? "",
        agents: {
          guardian: { score: result.agents?.guardian?.score ?? 0, assessment: result.agents?.guardian?.assessment ?? "" },
          archivist: { score: result.agents?.archivist?.score ?? 0, assessment: result.agents?.archivist?.assessment ?? "" },
          sentinel: { score: result.agents?.sentinel?.score ?? 0, assessment: result.agents?.sentinel?.assessment ?? "" },
          scout: { score: result.agents?.scout?.score ?? 0, assessment: result.agents?.scout?.assessment ?? "" },
          arbiter: { score: result.agents?.arbiter?.score ?? 0, assessment: result.agents?.arbiter?.assessment ?? "" },
        },
        recommendations: result.recommendations ?? [],
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Truth Network query failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 6: Get API Pricing & Usage
// Revenue: Discovery tool (drives paid usage)
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_get_pricing",
  {
    title: "Get AuthiChain API Pricing",
    description: `Get current AuthiChain API pricing tiers and usage information.

Returns pricing for all tiers: Starter ($99/mo), Growth ($499/mo), Enterprise ($2,499/mo), and pay-as-you-go rates.

Use when: A user asks about pricing, costs, or wants to compare plans.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const output = {
      currency: "USD",
      pay_as_you_go: {
        verification: "$0.05/call",
        registration: "$1.00/product",
        dpp_check: "$2.00/check",
        dpp_generation: "$10.00/passport",
        truth_network: "$0.10/query",
        search: "$0.01/call",
      },
      tiers: [
        {
          name: "Starter",
          price: "$99/month",
          includes: "1,000 verifications, 100 registrations, 50 DPP checks, API key, email support",
          best_for: "Small brands, startups, testing",
        },
        {
          name: "Growth",
          price: "$499/month",
          includes: "10,000 verifications, 1,000 registrations, 500 DPP checks, priority support, analytics dashboard",
          best_for: "Growing brands, mid-market manufacturers",
        },
        {
          name: "Enterprise",
          price: "$2,499/month",
          includes: "Unlimited verifications, 10,000 registrations, unlimited DPP, dedicated support, custom AI models, SLA",
          best_for: "Large manufacturers, EU DPP compliance at scale",
        },
        {
          name: "Custom",
          price: "Contact sales",
          includes: "Volume pricing, on-premise deployment, custom verticals, white-label options",
          best_for: "Fortune 500, government agencies, industry consortiums",
        },
      ],
      eu_dpp_packages: {
        smb: { price: "$2,000 setup + $99/mo", includes: "Up to 100 products, QR generation, basic DPP" },
        midmarket: { price: "$10,000 setup + $499/mo", includes: "Up to 5,000 products, full DPP, GS1 integration" },
        enterprise: { price: "$50,000 setup + $2,499/mo", includes: "Unlimited products, custom DPP, supply chain integration" },
      },
      polygon_gas: "< $0.001 per transaction (paid by AuthiChain, included in pricing)",
      stripe_billing: "Automated via Stripe (acct_1SXIyEGqTruSqV8T)",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 7: Mint Authentication Certificate
// Revenue: $0.10–1.00 per mint
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_mint_certificate",
  {
    title: "Mint Authentication Certificate NFT",
    description: `Mint a blockchain authentication certificate as an NFT on Polygon for a registered product.

The certificate is minted on Polygon (contract: 0x4da4D2675e52374639C9c954f4f653887A9972BE) and includes:
- Product identity hash
- Manufacturer attestation
- Trust Network consensus score
- Timestamp and chain of custody
- QR code link for consumer scanning

Args:
  - product_id (string): AuthiChain product ID (must be registered first)
  - metadata_uri (string, optional): IPFS URI for extended metadata

Returns: Transaction hash, token ID, certificate URL, and QR code for consumer verification.

Use when: A brand wants to create a blockchain-backed proof of authenticity for a product.`,
    inputSchema: {
      product_id: z.string().min(1).describe("AuthiChain product ID"),
      metadata_uri: z.string().optional().describe("IPFS URI for extended metadata"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ product_id, metadata_uri }) => {
    try {
      const result = await apiRequest<any>("certificates/mint", "POST", {
        product_id,
        metadata_uri: metadata_uri ?? null,
        source: "mcp",
      });

      const output = {
        product_id,
        token_id: result.token_id ?? null,
        transaction_hash: result.tx_hash ?? null,
        contract: "0x4da4D2675e52374639C9c954f4f653887A9972BE",
        network: "Polygon (chainId: 137)",
        certificate_url: result.certificate_url ?? null,
        qr_code_url: result.qr_code_url ?? null,
        gas_cost: result.gas_cost ?? "< $0.001",
        status: "minted",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Minting failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 8: Cannabis Verification (StrainChain)
// Revenue: $0.50–2.00 per cannabis verification
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  "authichain_verify_cannabis",
  {
    title: "Verify Cannabis Product (StrainChain)",
    description: `Verify a cannabis product through StrainChain — AuthiChain's cannabis-specific vertical.

Checks product against 1,001+ registered Michigan cannabis products including:
- Strain authenticity and genetics
- Lab test results (COA verification)
- Supply chain from cultivator to dispensary
- METRC compliance status
- Terpene and cannabinoid profiles

Args:
  - product_id (string): StrainChain product ID or QR code payload
  - include_lab_results (boolean): Include full COA/lab test data (default: false)

Returns: Cannabis-specific verification with strain info, lab data, and compliance status.

Use when: A consumer or dispensary asks about cannabis product authenticity or lab results.`,
    inputSchema: {
      product_id: z.string().min(1).describe("StrainChain product ID or QR payload"),
      include_lab_results: z.boolean().default(false).describe("Include full lab test / COA data"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ product_id, include_lab_results }) => {
    try {
      const result = await apiRequest<any>("strainchain/verify", "POST", {
        product_id, include_lab_results, source: "mcp",
      });

      const output = {
        product_id,
        verified: result.verified ?? false,
        strain_name: result.strain_name ?? null,
        strain_type: result.strain_type ?? null,
        cultivator: result.cultivator ?? null,
        dispensary: result.dispensary ?? null,
        trust_score: result.trust_score ?? 0,
        metrc_compliant: result.metrc_compliant ?? false,
        certificate_hash: result.certificate_hash ?? null,
        ...(include_lab_results ? {
          lab_results: {
            thc_percentage: result.lab?.thc ?? null,
            cbd_percentage: result.lab?.cbd ?? null,
            terpene_profile: result.lab?.terpenes ?? {},
            tested_by: result.lab?.lab_name ?? null,
            test_date: result.lab?.test_date ?? null,
            passed: result.lab?.passed ?? false,
          },
        } : {}),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Cannabis verification failed: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TRANSPORT — Stdio (local) or Streamable HTTP (remote/deployed)
// ═══════════════════════════════════════════════════════════════

const transportMode = process.env.TRANSPORT_MODE || "stdio";

async function main() {
  if (transportMode === "http") {
    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.setHeader("Content-Type", "application/json");
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        server: "authichain-mcp-server",
        version: "1.0.0",
        tools: 8,
        uptime: process.uptime(),
      });
    });

    const PORT = parseInt(process.env.PORT || "3847", 10);
    app.listen(PORT, () => {
      console.log(`AuthiChain MCP Server running on http://localhost:${PORT}/mcp`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Tools: 8 | Revenue endpoints: 7`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AuthiChain MCP Server running on stdio");
  }
}

main().catch(err => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
