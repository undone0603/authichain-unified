import { describe, expect, it } from "vitest";
import { tryHandleMcp } from "./mcp-routes";
import { handleA2aJsonRpc, memoryA2aStore } from "../../../src/lib/a2a-jsonrpc";

function mcp(method: string, params?: unknown) {
  return new Request("https://authichain.com/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
  });
}

describe("MCP/A2A negotiate discovery boundaries", () => {
  it("advertises the negotiate MCP tool with a closed argument schema", async () => {
    const res = await tryHandleMcp(mcp("tools/list"));
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { result: { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> } };
    const tool = body.result.tools.find(t => t.name === "get_agent_compatibility");
    expect(tool).toBeDefined();
    expect(tool?.inputSchema.additionalProperties).toBe(false);
  });

  it("returns compatibility data, never a token or connection state", async () => {
    const res = await tryHandleMcp(mcp("tools/call", {
      name: "get_agent_compatibility",
      arguments: {
        intent: "discover",
        mcpVersions: ["2025-06-18"],
        a2aVersions: ["1.0"],
        capabilities: ["mcp.tools.list", "a2a.agent_card.read"],
      },
    }));
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { result: { content: Array<{ text: string }>; isError?: boolean } };
    expect(body.result.isError).not.toBe(true);
    const info = JSON.parse(body.result.content[0].text);
    expect(info.status).toBe("compatible_read_only");
    expect(info.authorized).toBe(false);
    expect(info.connected).toBe(false);
    expect(JSON.stringify(info)).not.toContain("access_token");
  });

  it("rejects capability escalation as an MCP tool error", async () => {
    const res = await tryHandleMcp(mcp("tools/call", {
      name: "get_agent_compatibility",
      arguments: { mcpVersions: ["2025-06-18"], intent: "pay", capabilities: ["mcp.tools.pay"] },
    }));
    const body = (await res!.json()) as { result: { content: Array<{ text: string }>; isError: boolean } };
    expect(body.result.isError).toBe(true);
    expect(JSON.parse(body.result.content[0].text).authorized).toBe(false);
  });

  it("A2A SendMessage can explain negotiation, but must not claim a peer connection", () => {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "SendMessage",
      params: {
        message: {
          messageId: "negotiate-test-1",
          role: "ROLE_USER",
          parts: [{ text: "MCP and A2A capability negotiation" }],
        },
      },
    });
    const result = handleA2aJsonRpc(raw, { store: memoryA2aStore(), now: new Date("2026-11-04T00:00:00Z") });
    expect(result.status).toBe(200);
    const body = result.body as {
      result: { task: { artifacts: Array<{ parts: Array<{ text: string }> }> } };
    };
    const text = body.result.task.artifacts[0].parts[0].text;
    expect(text).toContain("https://authichain.com/agent-compatibility");
    expect(text).toContain("No external peer is connected");
    expect(text).not.toContain("buy.stripe.com");
  });
});
