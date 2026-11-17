#!/usr/bin/env node
// Side-effect-free AgentZ MCP handshake smoke. No token or response body is logged.
const endpoint = process.env.AGENTZ_MCP_URL || "https://authichain-agentz-mcp-edge.undone-k.workers.dev/mcp";
const token = process.env.AGENTZ_MCP_TOKEN || "";
const url = new URL(endpoint);
if (url.protocol !== "https:" || url.hostname !== "authichain-agentz-mcp-edge.undone-k.workers.dev" || url.pathname !== "/mcp" || url.username || url.password || url.search || url.hash) {
  throw new Error("Refusing unapproved host, non-HTTPS, non-/mcp or credential-bearing endpoint");
}
const health = new URL("/health", url);
const controller = new AbortController();
const abortTimer = setTimeout(() => controller.abort(), 12000);
async function request(path, auth, payload) {
  const res = await fetch(path, {
    method: payload ? "POST" : "GET",
    headers: {
      ...(payload ? { "content-type": "application/json", "accept": "application/json, text/event-stream" } : {}),
      ...(auth ? { authorization: `Bearer ${token}` } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: controller.signal,
    redirect: "error"
  });
  return res;
}
function assert(value, message) { if (!value) throw new Error(message); }
try {
  const live = await request(health, false);
  assert(live.status === 200, `health: expected 200, got ${live.status}`);
  const ready = await live.json();
  assert(ready.service === "agentz-mcp-edge", "health: unexpected service");
  console.log("PASS health: 200 AgentZ");

  const anonymous = await request(url, false, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert(anonymous.status === 401 || anonymous.status === 503, `anonymous tools/list: expected 401 or unconfigured 503, got ${anonymous.status}`);
  console.log(`PASS anonymous tools/list rejected: ${anonymous.status}`);

  if (!token) {
    console.log("SKIP authenticated handshake (no AGENTZ_MCP_TOKEN in environment)");
  } else {
    const init = await request(url, true, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "agentz-safe-smoke", version: "0.1.0" } } });
    assert(init.ok, `initialize HTTP ${init.status}`);
    const handshake = await init.json();
    assert(handshake.result?.serverInfo?.name === "agentz-cloudflare-edge", "initialize: unexpected server");
    console.log(`PASS initialize: ${handshake.result.protocolVersion}`);

    const list = await request(url, true, { jsonrpc: "2.0", id: 3, method: "tools/list" });
    assert(list.ok, `tools/list HTTP ${list.status}`);
    const catalog = await list.json();
    const names = catalog.result?.tools?.map(x => x.name).sort();
    assert(JSON.stringify(names) === JSON.stringify(["agentz_enqueue_probe", "agentz_memory_recent", "agentz_readiness"]), "tools/list: unexpected tool inventory");
    console.log("PASS authenticated tools/list: three bounded tools");

    const call = await request(url, true, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "agentz_readiness", arguments: {} } });
    assert(call.ok, `readiness HTTP ${call.status}`);
    const response = await call.json();
    const text = response.result?.content?.find(x => x.type === "text")?.text;
    const readiness = JSON.parse(text || "null");
    assert(readiness?.cloudflare_edge === true && readiness.browser_inspect === false && readiness.code_write === false && readiness.production_dispatch === false, "readiness boundary changed");
    console.log("PASS read-only readiness and disabled unsafe capabilities");
  }
} finally {
  clearTimeout(abortTimer);
}
