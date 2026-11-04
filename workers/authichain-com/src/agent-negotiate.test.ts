import { describe, expect, it } from "vitest";
import {
  negotiateAgentCapabilities,
  tryHandleAgentNegotiate,
  MCP_NEGOTIATE_VERSIONS,
} from "./agent-negotiate";

const req = (path: string, init?: RequestInit) =>
  new Request("https://authichain.com" + path, init);

describe("capability negotiation is not peer authorization", () => {
  it("lists only real server-supported versions and refuses modern MCP 2026", () => {
    expect(MCP_NEGOTIATE_VERSIONS).toEqual(["2025-06-18", "2025-03-26", "2024-11-05"]);
    const result = negotiateAgentCapabilities({ mcpVersions: ["2026-07-28"], a2aVersions: ["1.0"] });
    expect(result.status).toBe("unsupported");
    expect(result.authorized).toBe(false);
    expect(result.connected).toBe(false);
  });

  it("negotiates common legacy MCP and A2A 1.0 as hints only", () => {
    const result = negotiateAgentCapabilities({
      intent: "discover",
      mcpVersions: ["2025-03-26", "2025-06-18"],
      a2aVersions: ["1.0"],
      capabilities: ["mcp.tools.list", "a2a.agent_card.read"],
    });
    expect(result.status).toBe("compatible_read_only");
    expect(result.mcp.selectedVersion).toBe("2025-06-18");
    expect(result.a2a.selectedVersion).toBe("1.0");
    expect(result.capabilities.allowed).toEqual(["mcp.tools.list", "a2a.agent_card.read"]);
    expect(result.authorized).toBe(false);
  });

  it("does not treat discovery with no offered versions as a handshake", () => {
    const result = negotiateAgentCapabilities({});
    expect(result.status).toBe("discovery_only");
    expect(result.mcp.selectedVersion).toBeNull();
    expect(result.a2a.selectedVersion).toBeNull();
  });

  it.each(["connect", "message", "pay", "settle", "sign", "authorize", "deploy"])(
    "never authorizes intent %s",
    intent => {
      const result = negotiateAgentCapabilities({ intent, mcpVersions: ["2025-06-18"] });
      expect(result.status).toBe("approval_required");
      expect(result.capabilities.allowed).toEqual([]);
      expect(result.authorized).toBe(false);
    }
  );

  it("requires every explicitly named protocol to have a compatible version", () => {
    expect(negotiateAgentCapabilities({ mcpVersions: ["2025-06-18"], a2aVersions: ["0.3"] }).status)
      .toBe("unsupported");
  });

  it("rejects unknown capabilities, excess input and non-record payloads", () => {
    const v = negotiateAgentCapabilities({
      mcpVersions: ["2025-06-18"],
      capabilities: ["mcp.tools.list", "mcp.tools.send_payment"],
    });
    expect(v.status).toBe("approval_required");
    expect(v.capabilities.allowed).toEqual([]);
    expect(v.capabilities.denied).toEqual(["mcp.tools.send_payment"]);
    expect(negotiateAgentCapabilities({ mcpVersions: Array(9).fill("2025-06-18") }).status)
      .toBe("invalid_request");
    expect(negotiateAgentCapabilities({ secret: "do-not-echo" }).status).toBe("invalid_request");
    expect(negotiateAgentCapabilities([]).status).toBe("invalid_request");
    expect(JSON.stringify(negotiateAgentCapabilities({ secret: "private" }))).not.toContain("private");
  });

  it("GET and HEAD expose only a public discovery", async () => {
    for (const path of ["/negotiate", "/api/negotiate"]) {
      const res = await tryHandleAgentNegotiate(req(path));
      expect(res?.status).toBe(200);
      expect((await res!.json()).status).toBe("discovery_only");
      expect((await tryHandleAgentNegotiate(req(path, { method: "HEAD" })) )?.status).toBe(204);
    }
    expect(await tryHandleAgentNegotiate(req("/checkout"))).toBeNull();
  });

  it("POST returns compatibility hints and does not establish trust", async () => {
    const res = await tryHandleAgentNegotiate(req("/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcpVersions: ["2025-06-18"], capabilities: ["mcp.tools.list"] }),
    }));
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.status).toBe("compatible_read_only");
    expect(body.connected).toBe(false);
    expect(body.authorized).toBe(false);
  });

  it("rejects credential-bearing or prohibited requests without executing", async () => {
    const res = await tryHandleAgentNegotiate(req("/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "pay", mcpVersions: ["2025-06-18"] }),
    }));
    expect(res?.status).toBe(403);
    expect((await res!.json()).status).toBe("approval_required");
  });

  it("rejects invalid JSON, wrong content type, oversized bodies and cross-origin calls", async () => {
    const cases: Array<[RequestInit, number]> = [
      [{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }, 400],
      [{ method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }, 415],
      [{ method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(4097) }, 413],
      [{ method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: "{}" }, 403],
    ];
    for (const [init, status] of cases) {
      expect((await tryHandleAgentNegotiate(req("/negotiate", init)))?.status).toBe(status);
    }
  });

  it("OPTIONS honors same-origin only and PUT is denied", async () => {
    const res = await tryHandleAgentNegotiate(req("/negotiate", {
      method: "OPTIONS",
      headers: { Origin: "https://authichain.com" },
    }));
    expect(res?.status).toBe(204);
    expect((await tryHandleAgentNegotiate(req("/negotiate", { method: "PUT" })))?.status).toBe(405);
  });
});
