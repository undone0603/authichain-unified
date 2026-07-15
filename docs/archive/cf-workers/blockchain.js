--62631b9a322466be3469fb2d559656a3a2bb6ecc2a37858e8ed9be3ec4ea
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
};
var DEFAULT_RPC = {
  polygon: "https://polygon-rpc.com",
  ethereum: "https://cloudflare-eth.com"
};
async function handleRpcProxy(request, env, network) {
  const rpcUrl = (network === "polygon" ? env.POLYGON_RPC_URL : env.ETH_RPC_URL) || DEFAULT_RPC[network];
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }
  const body = await request.text();
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return Response.json({ error: "RPC connection failed", details: String(err) }, { status: 502, headers: CORS_HEADERS });
  }
}
__name(handleRpcProxy, "handleRpcProxy");
async function handleStatus(env) {
  const start = Date.now();
  let polygonStatus = "offline";
  let ethStatus = "offline";
  try {
    const polyRes = await fetch(env.POLYGON_RPC_URL || DEFAULT_RPC.polygon, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
    });
    if (polyRes.ok) polygonStatus = "online";
  } catch {
  }
  try {
    const ethRes = await fetch(env.ETH_RPC_URL || DEFAULT_RPC.ethereum, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
    });
    if (ethRes.ok) ethStatus = "online";
  } catch {
  }
  return Response.json({
    status: "operational",
    networks: {
      polygon: { status: polygonStatus, rpc: env.POLYGON_RPC_URL ? "custom" : "default" },
      ethereum: { status: ethStatus, rpc: env.ETH_RPC_URL ? "custom" : "default" }
    },
    latency: `${Date.now() - start}ms`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, { headers: CORS_HEADERS });
}
__name(handleStatus, "handleStatus");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }
    if (path === "/status" || path === "/health") {
      return handleStatus(env);
    }
    if (path === "/v1/polygon" || path === "/polygon") {
      return handleRpcProxy(request, env, "polygon");
    }
    if (path === "/v1/ethereum" || path === "/ethereum") {
      return handleRpcProxy(request, env, "ethereum");
    }
    return Response.json({
      name: "AuthiChain Blockchain Gateway",
      version: "1.0.0",
      endpoints: ["/polygon", "/ethereum", "/status"],
      protocol: "AuthiChain Truth Layer"
    }, { headers: CORS_HEADERS });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--62631b9a322466be3469fb2d559656a3a2bb6ecc2a37858e8ed9be3ec4ea--
