import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { validateTargetUrl, executeHttpRequest, executeMcpProbe, executeBatchHealthCheck } from "../src/rest-client.mjs";
import { handleMcpRequest } from "../src/mcp-handler.mjs";

test("validateTargetUrl blocks http:// and private/loopback IPs by default", () => {
  assert.throws(() => validateTargetUrl("http://example.com"), /Blocked protocol/);
  assert.throws(() => validateTargetUrl("https://127.0.0.1/mcp"), /Blocked private\/loopback/);
  assert.throws(() => validateTargetUrl("https://169.254.169.254/latest/meta-data"), /Blocked private\/loopback/);
  assert.throws(() => validateTargetUrl("https://localhost:3099/"), /Blocked private\/loopback/);
  assert.doesNotThrow(() => validateTargetUrl("https://signal.authichain.com/mcp"));
});

test("executeHttpRequest, mcp_probe, batch_health_check, and handleMcpRequest work end-to-end", async () => {
  const mockServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "secret=abc" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "POST" && req.url === "/mcp") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const rpc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { echoedMethod: rpc.method } }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const { port } = mockServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = { ALLOW_INSECURE_HTTP: "true", REQBIN_ALLOWLIST: "127.0.0.1", REQBIN_BEARER_TOKEN: "test-secret" };

  try {
    const httpRes = await executeHttpRequest({ method: "GET", url: `${baseUrl}/health` }, env);
    assert.equal(httpRes.status, 200);
    assert.deepEqual(httpRes.json, { ok: true });
    assert.equal(httpRes.headers["set-cookie"], "[REDACTED]");

    const probeRes = await executeMcpProbe({ url: `${baseUrl}/mcp`, mode: "initialize" }, env);
    assert.equal(probeRes.initialize.status, 200);
    assert.equal(probeRes.initialize.json.result.echoedMethod, "initialize");

    const batchRes = await executeBatchHealthCheck({ urls: [`${baseUrl}/health`, `${baseUrl}/missing`] }, env);
    assert.equal(batchRes.total, 2);
    assert.equal(batchRes.healthy, 1);

    const unauthRes = await handleMcpRequest(new Request("https://example.com/mcp", { method: "GET" }), env);
    assert.equal(unauthRes.status, 401);

    const authGet = await handleMcpRequest(
      new Request("https://example.com/mcp", {
        method: "GET",
        headers: { Authorization: "Bearer test-secret" },
      }),
      env,
    );
    assert.equal(authGet.status, 200);
    const meta = await authGet.json();
    assert.equal(meta.serverInfo.name, "reqbin-rest");

    const callRes = await handleMcpRequest(
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "http_request", arguments: { method: "GET", url: `${baseUrl}/health` } },
        }),
      }),
      env,
    );
    assert.equal(callRes.status, 200);
    const callJson = await callRes.json();
    const inner = JSON.parse(callJson.result.content[0].text);
    assert.equal(inner.status, 200);
  } finally {
    mockServer.close();
  }
});
