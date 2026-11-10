/**
 * Public-tunnel-safe MCP fixture for Glama Inspector / mcp-proxy.
 *
 * This is NOT the production AuthiChain server. It demonstrates protocol
 * transport and tool descriptions with synthetic data only. It does not
 * load credentials, use network/database clients, or implement payments.
 * Never market it as evidence that production verification works.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const FIXTURE_TOOLS = Object.freeze([
  {
    name: "get_pricing",
    description:
      "Fixture only. Read synthetic zero-dollar prices; does not quote live AuthiChain offers or start checkout.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "negotiate",
    description:
      "Fixture only. Give a synthetic non-binding zero-dollar quote without authorizing payment, storing data, or contacting production.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        service: {
          type: "string",
          enum: ["verify_record"],
          description: "Only the synthetic, free verification example is supported.",
        },
        mode: {
          type: "string",
          enum: ["quote_only"],
          description: "Nonbinding quote; no acceptance or settlement.",
        },
      },
      required: ["service"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
]);

export function fixtureReply(name, args = {}) {
  if (name === "get_pricing") {
    return {
      fixture: true,
      status: "synthetic_only",
      price_usd: 0,
      payment_authorized: false,
      settled: false,
      side_effects: false,
      production: false,
    };
  }
  if (
    name === "negotiate" &&
    args?.service === "verify_record" &&
    (args.mode === undefined || args.mode === "quote_only") &&
    Object.keys(args).every(key => ["service", "mode"].includes(key))
  ) {
    return {
      fixture: true,
      service: "verify_record",
      status: "non_binding_quote",
      price_usd: 0,
      binding: false,
      accepted: false,
      payment_authorized: false,
      settled: false,
      side_effects: false,
      production: false,
    };
  }
  return {
    fixture: true,
    error: "unsupported_fixture_request",
    payment_authorized: false,
    settled: false,
    side_effects: false,
    production: false,
  };
}

export function buildFixtureServer() {
  const server = new Server(
    { name: "authichain-inspector-fixture-NOT-PRODUCTION", version: "0.0.0-fixture" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: FIXTURE_TOOLS,
  }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: input } = request.params;
    const args = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const reply = fixtureReply(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(reply) }],
      structuredContent: reply,
      ...("error" in reply ? { isError: true } : {}),
    };
  });
  return server;
}

async function main() {
  const server = buildFixtureServer();
  await server.connect(new StdioServerTransport());
  console.error("Fixture-only AuthiChain inspector server on stdio: NO production access");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("Fixture startup failed:", error?.message ?? "unknown");
    process.exitCode = 1;
  });
}
