// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TOOLS, tryHandleMcp } from "./mcp-routes";
import { FREE_TOOL_NAMES, isMcpFreePath, tryHandleMcpFree } from "./mcp-free-routes";

const PAID_TOOLS = [
  "verify",
  "authichain_verify_product",
  "get_pricing",
  "authichain_get_pricing",
  "query_provenance",
  "authichain_query_provenance",
];
const FORBIDDEN = /x402|price|pay|cent|\$|upgrade/i;

function post(path: string, body: unknown): Request {
  return new Request(`https://authichain.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
}

async function freeRpc(body: unknown) {
  const res = await tryHandleMcpFree(post("/mcp/free", body));
  expect(res).not.toBeNull();
  return { res: res!, text: await res!.text() };
}

describe("/mcp/free", () => {
  it("matches only /mcp/free", () => {
    expect(isMcpFreePath("/mcp/free")).toBe(true);
    expect(isMcpFreePath("/mcp/free/")).toBe(true);
    expect(isMcpFreePath("/mcp")).toBe(false);
    expect(isMcpFreePath("/api/mcp")).toBe(false);
  });

  it("tools/list excludes every paid tool", async () => {
    const { text } = await freeRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = JSON.parse(text).result.tools.map((t: { name: string }) => t.name);
    expect(names.sort()).toEqual([...FREE_TOOL_NAMES].sort());
    for (const paid of PAID_TOOLS) expect(names).not.toContain(paid);
  });

  it("tools/list JSON has no payment, price, or upsell text", async () => {
    const { text } = await freeRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(text).not.toMatch(FORBIDDEN);
  });

  it("initialize server info and instructions have no payment text", async () => {
    const { text } = await freeRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(JSON.parse(text).result.serverInfo.name).toBe("authichain-free");
    expect(text).not.toMatch(FORBIDDEN);
  });

  it("GET discovery has no payment text", async () => {
    const res = await tryHandleMcpFree(new Request("https://authichain.com/mcp/free"));
    expect(res!.status).toBe(200);
    expect(await res!.text()).not.toMatch(FORBIDDEN);
  });

  it("calling a paid tool errors", async () => {
    for (const name of PAID_TOOLS) {
      const { text } = await freeRpc({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name, arguments: { sealId: "00000000-0000-4000-8000-000000000000" } },
      });
      const body = JSON.parse(text);
      expect(body.error, name).toBeDefined();
      expect(body.result, name).toBeUndefined();
    }
  });

  it("calling a free tool delegates to the /mcp handler", async () => {
    const call = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "dpp_readiness_check", arguments: { category: "battery" } } };
    const free = await freeRpc(call);
    const base = await (await tryHandleMcp(post("/mcp", call)))!.text();
    expect(free.text).toBe(base);
  });
});

describe("/mcp/free verify_record is fully free", () => {
  it("touches no x402 env, KV quota, or payment binding", async () => {
    const touched: string[] = [];
    const env = new Proxy({} as Record<string, unknown>, {
      get(_t, k) { touched.push(String(k)); return undefined; },
      has(_t, k) { touched.push(String(k)); return false; },
    });
    const urls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input instanceof Request ? input.url : input));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const res = await tryHandleMcpFree(
        post("/mcp/free", { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "verify_record", arguments: { id: "polygon-anchor-1" } } }),
        env as never
      );
      const body = JSON.parse(await res!.text());
      expect(body.result).toBeDefined();
      expect(res!.status).toBe(200);
    } finally {
      globalThis.fetch = realFetch;
    }
    // Only the optional Polygon RPC override is read; no X402_*, KV, VERIFY_APP.
    expect(touched.filter(k => k !== "POLYGON_RPC_URL" && typeof k === "string" && !k.startsWith("Symbol"))).toEqual([]);
    for (const u of urls) expect(u).not.toMatch(/x402|facilitator|pay/i);
  });
});

describe("/mcp unchanged", () => {
  it("tools/list matches the pre-change snapshot", async () => {
    const res = await tryHandleMcp(post("/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }));
    expect(await res!.text()).toMatchSnapshot();
  });
  it("TOOLS still lists verify", () => {
    expect(TOOLS.map(t => t.name)).toContain("verify");
  });
  it("tryHandleMcp ignores /mcp/free", async () => {
    expect(await tryHandleMcp(post("/mcp/free", { jsonrpc: "2.0", id: 1, method: "tools/list" }))).toBeNull();
  });
});
