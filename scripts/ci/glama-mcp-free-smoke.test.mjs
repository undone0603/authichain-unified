import assert from "node:assert/strict";
import test from "node:test";
import { EXPECTED_TOOLS, runFreeMcpSmoke } from "./glama-mcp-free-smoke.mjs";

const version = "1.4.0";
const tools = EXPECTED_TOOLS.map(name => ({
  name,
  description: name,
  annotations: {
    readOnlyHint: name !== "verify",
    destructiveHint: name === "verify",
  },
}));

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockTransport({ toolList = tools } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers ?? {}, body: options.body });
    assert.equal(url, "https://authichain.com/mcp");
    if (options.method === "GET") {
      return json({ serverInfo: { version }, tools: toolList, pricing: { freeTools: EXPECTED_TOOLS.filter(name => name !== "verify") } });
    }
    assert.equal(options.method, "POST");
    const request = JSON.parse(options.body);
    const result =
      request.method === "initialize"
        ? { serverInfo: { version }, protocolVersion: "2025-06-18" }
        : request.method === "tools/list"
          ? { tools: toolList }
          : request.method === "tools/call" && request.params.name === "negotiate"
            ? {
                structuredContent: {
                  service: "verify_record",
                  binding: false,
                  side_effects: false,
                  payment_authorized: false,
                  settled: false,
                  price_usd: 0,
                },
              }
            : null;
    assert.ok(result, "Only allowlisted metadata and quote calls are supported");
    return json({ jsonrpc: "2.0", id: request.id, result });
  };
  return { fetchImpl, calls };
}

test("no-payment smoke verifies discovery, POST transport, and nonbinding quote", async () => {
  const mocked = mockTransport();
  const result = await runFreeMcpSmoke({
    fetchImpl: mocked.fetchImpl,
    requireHints: true,
    log: () => {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.toolCount, 8);
  assert.equal(result.paidCalls, 0);
  assert.equal(result.settlementAttempts, 0);
  assert.equal(mocked.calls.length, 4);
  assert.deepEqual(
    mocked.calls.slice(1).map(call => JSON.parse(call.body).method),
    ["initialize", "tools/list", "tools/call"]
  );
  const calls = mocked.calls.map(call => call.body ?? "").join("\n");
  assert.ok(!calls.includes('"name":"verify"'));
  for (const call of mocked.calls) {
    assert.equal(call.headers.authorization, undefined);
    assert.equal(call.headers["X-Payment-Tx"], undefined);
    assert.equal(call.headers["PAYMENT-SIGNATURE"], undefined);
  }
});

test("release-hint mode fails closed if tool annotations are missing", async () => {
  const mocked = mockTransport({
    toolList: tools.map(tool => tool.name === "get_pricing" ? { name: tool.name } : tool),
  });
  await assert.rejects(
    runFreeMcpSmoke({ fetchImpl: mocked.fetchImpl, requireHints: true, log: () => {} }),
    /get_pricing missing readOnlyHint=true/
  );
  assert.equal(mocked.calls.length, 3);
});

test("smoke rejects incomplete discovery before making POST calls", async () => {
  const mocked = mockTransport({ toolList: tools.filter(tool => tool.name !== "verify_record") });
  await assert.rejects(
    runFreeMcpSmoke({ fetchImpl: mocked.fetchImpl, log: () => {} }),
    /Discovery tool list differs/
  );
  assert.equal(mocked.calls.length, 1);
});
