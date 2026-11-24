import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  endpointFromArgs,
  runHostedQuickstart,
} from "../../mcp/examples/hosted-quickstart.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const readmePath = path.join(repoRoot, "mcp/docs/README.md");
const mcpRoutesPath = path.join(
  repoRoot,
  "workers/authichain-com/src/mcp-routes.ts"
);
const quickstartPath = path.join(
  repoRoot,
  "mcp/examples/hosted-quickstart.mjs"
);

const readme = fs.readFileSync(readmePath, "utf8");
const mcpRoutes = fs.readFileSync(mcpRoutesPath, "utf8");
const quickstartSource = fs.readFileSync(quickstartPath, "utf8");

const EXPECTED_TOOLS = [
  "get_pricing",
  "verify",
  "query_provenance",
  "verify_attestation",
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
  "negotiate",
];

describe("hosted MCP documentation and quickstart", () => {
  it("documents the hosted MCP endpoint and install page", () => {
    expect(readme).toContain("https://authichain.com/mcp");
    expect(readme).toContain("https://authichain.com/mcp/install");
  });

  it("includes Claude Code, Cursor, VS Code (servers), and Generic (mcpServers) configs", () => {
    expect(readme).toMatch(/Claude Code/i);
    expect(readme).toMatch(/Cursor/i);
    expect(readme).toMatch(/VS Code/i);
    expect(readme).toContain('"servers"');
    expect(readme).toContain('"mcpServers"');
  });

  it("does not reference legacy dist/index.js or mandatory DATABASE_URL quickstart", () => {
    expect(readme).not.toContain("dist/index.js");
    expect(readme).not.toMatch(/["']DATABASE_URL["']\s*:/);
    expect(readme).not.toMatch(/(?:export\s+)?DATABASE_URL\s*=/);
  });

  it("documents all 8 tools defined in mcp-routes.ts", () => {
    for (const toolName of EXPECTED_TOOLS) {
      expect(mcpRoutes).toContain(toolName);
      expect(readme).toContain(toolName);
    }
  });

  it("contains no embedded secrets in docs or quickstart example", () => {
    for (const content of [readme, quickstartSource]) {
      expect(content).not.toContain("sk_live_");
      expect(content).not.toContain("whsec_");
      expect(content).not.toContain("sbp_");
    }
  });

  it("runs runHostedQuickstart with a mocked fetchImpl", async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (body.method === "initialize") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: { protocolVersion: "2025-06-18" },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (body.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      if (body.method === "tools/list") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              tools: EXPECTED_TOOLS.map(name => ({ name })),
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (body.method === "tools/call") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    classification: "verified",
                    limitations: ["Does not inspect physical goods"],
                  }),
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("Unexpected method", { status: 400 });
    });

    const result = await runHostedQuickstart({ fetchImpl: mockFetch });

    expect(result).toEqual({
      connected: true,
      protocolVersion: "2025-06-18",
      tools: EXPECTED_TOOLS,
      toolCallOk: true,
      classification: "verified",
      limitations: ["Does not inspect physical goods"],
    });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("handles HTTP errors cleanly in runHostedQuickstart", async () => {
    const errorFetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    });

    const result = await runHostedQuickstart({ fetchImpl: errorFetch });

    expect(result.connected).toBe(false);
    expect(result.toolCallOk).toBe(false);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  describe("JSON-RPC response integrity", () => {
    const methods = ["initialize", "tools/list", "tools/call"] as const;
    const defects = [
      "empty",
      "wrong version",
      "wrong ID",
      "string ID",
      "both result and error",
      "neither result nor error",
    ] as const;

    for (const method of methods) {
      for (const defect of defects) {
        it(`rejects ${defect} at ${method} without further requests`, async () => {
          const seen: string[] = [];
          const mockFetch: typeof fetch = async (_url, init) => {
            const body = JSON.parse(String(init?.body ?? "{}"));
            seen.push(body.method);
            if (body.method === "notifications/initialized") {
              return new Response(null, { status: 202 });
            }
            const result =
              body.method === "initialize"
                ? { protocolVersion: "2025-06-18" }
                : body.method === "tools/list"
                  ? { tools: [{ name: "verify_record" }] }
                  : {
                      content: [
                        {
                          type: "text",
                          text: JSON.stringify({ classification: "verified" }),
                        },
                      ],
                    };
            const envelope: Record<string, unknown> = {
              jsonrpc: "2.0",
              id: body.id,
              result,
            };
            if (body.method === method) {
              switch (defect) {
                case "empty":
                  return new Response(null, { status: 200 });
                case "wrong version":
                  envelope.jsonrpc = "1.0";
                  break;
                case "wrong ID":
                  envelope.id = 999;
                  break;
                case "string ID":
                  envelope.id = String(body.id);
                  break;
                case "both result and error":
                  envelope.error = { code: -32603, message: "mock error" };
                  break;
                case "neither result nor error":
                  delete envelope.result;
                  break;
              }
            }
            return new Response(JSON.stringify(envelope));
          };

          const result = await runHostedQuickstart({ fetchImpl: mockFetch });

          expect(result.toolCallOk).toBe(false);
          expect(result.classification).toBeNull();
          expect(result.limitations).toContain(
            "Invalid or mismatched JSON-RPC response"
          );
          const expected = [
            "initialize",
            "notifications/initialized",
            "tools/list",
            "tools/call",
          ];
          expect(seen).toEqual(expected.slice(0, expected.indexOf(method) + 1));
        });
      }
    }

    it("does not call a tool that was not advertised", async () => {
      const seen: string[] = [];
      const mockFetch: typeof fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        seen.push(body.method);
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result:
              body.method === "initialize"
                ? { protocolVersion: "2025-06-18" }
                : { tools: [{ name: "get_pricing" }] },
          })
        );
      };

      const result = await runHostedQuickstart({ fetchImpl: mockFetch });

      expect(result.connected).toBe(true);
      expect(result.toolCallOk).toBe(false);
      expect(result.classification).toBeNull();
      expect(result.limitations).toContain("verify_record was not advertised");
      expect(seen).toEqual([
        "initialize",
        "notifications/initialized",
        "tools/list",
      ]);
    });
  });

  it("takes the endpoint from --endpoint, then AUTHICHAIN_MCP_ENDPOINT", () => {
    const free = "https://authichain.com/mcp/free";
    expect(endpointFromArgs(["--endpoint", free], {})).toBe(free);
    expect(
      endpointFromArgs(["--endpoint", free], {
        AUTHICHAIN_MCP_ENDPOINT: "https://example.test/mcp",
      })
    ).toBe(free);
    expect(endpointFromArgs([], { AUTHICHAIN_MCP_ENDPOINT: free })).toBe(free);
    expect(endpointFromArgs([], {})).toBeUndefined();
    expect(endpointFromArgs(["--endpoint"], {})).toBeUndefined();
  });
});
