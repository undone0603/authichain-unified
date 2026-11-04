import test from "node:test";
import assert from "node:assert/strict";
import {
  MCP_URL,
  AGENT_CARD_URL,
  A2A_ENDPOINT,
  assessMcpHandshake,
  assessA2aCard,
  probeAuthichainConnections,
} from "./probe.mjs";

const init = {
  protocolVersion: "2025-06-18",
  serverInfo: { name: "authichain", version: "1.4.0" },
};
const tools = { tools: [{ name: "verify_record" }, { name: "get_agent_setup_offers" }] };
const card = {
  name: "AuthiChain",
  skills: [{ id: "paid-evidence-check", name: "Paid evidence check" }],
  supportedInterfaces: [
    { protocolBinding: "JSONRPC", protocolVersion: "1.0", url: A2A_ENDPOINT },
  ],
};
test("MCP handshake requires published free verifier and setup offer", () => {
  assert.equal(assessMcpHandshake(init, tools).technical_status, "compatible");
  assert.equal(
    assessMcpHandshake(init, { tools: [{ name: "verify_record" }] }).technical_status,
    "review_required"
  );
  assert.equal(assessMcpHandshake({}, tools).technical_status, "review_required");
});
test("A2A card requires an exact advertised JSON-RPC interface", () => {
  assert.equal(assessA2aCard(card).technical_status, "compatible");
  assert.equal(
    assessA2aCard({
      ...card,
      supportedInterfaces: [
        { protocolBinding: "JSONRPC", protocolVersion: "1.0", url: "https://evil.example/a2a" },
      ],
    }).technical_status,
    "review_required"
  );
  assert.equal(assessA2aCard({ ...card, skills: [] }).technical_status, "review_required");
});
function mockFetch(calls) {
  return async (url, options) => {
    calls.push({ url, method: options.method, body: options.body });
    if (url === AGENT_CARD_URL) {
      return new Response(JSON.stringify(card), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url !== MCP_URL) throw new Error("UNEXPECTED_EGRESS");
    const request = JSON.parse(options.body);
    const result = request.method === "initialize" ? init : tools;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
      headers: { "content-type": "application/json" },
    });
  };
}
test("probe performs only fixed-origin initialization, tools/list and public Agent Card GET", async () => {
  const calls = [];
  const report = await probeAuthichainConnections({ fetchImpl: mockFetch(calls) });
  assert.equal(report.mcp.technical_status, "compatible");
  assert.equal(report.a2a.technical_status, "compatible");
  assert.equal(report.connection, "AUTHICHAIN_ENDPOINTS_ONLY_NOT_EXTERNAL_PEER_CONNECTED");
  assert.equal(report.permissions.payment, false);
  assert.deepEqual(calls.map(c => [c.url, c.method]), [
    [MCP_URL, "POST"],
    [MCP_URL, "POST"],
    [AGENT_CARD_URL, "GET"],
  ]);
  assert.ok(!calls.some(c => /tools\/call|SendMessage|payment-signature|checkout/i.test(c.body || "")));
});
test("fails closed on malicious MCP error or missing tools", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    if (url === AGENT_CARD_URL) return new Response(JSON.stringify(card), { headers: { "content-type": "application/json" } });
    const request = JSON.parse(options.body);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      ...(request.method === "initialize"
        ? { result: init }
        : { error: { code: -32601, message: "Unknown" } }),
    }), { headers: { "content-type": "application/json" } });
  };
  await assert.rejects(probeAuthichainConnections({ fetchImpl }), /MCP_JSONRPC_MISMATCH/);
});
test("refuses HTML / non JSON content", async () => {
  const fetchImpl = async () => new Response("<html>login</html>", {
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(probeAuthichainConnections({ fetchImpl }), /EXPECTED_JSON_RESPONSE/);
});
test("rejects oversized responses before parsing", async () => {
  const fetchImpl = async () => new Response("x".repeat(150000), {
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(probeAuthichainConnections({ fetchImpl }), /RESPONSE_TOO_LARGE/);
});
