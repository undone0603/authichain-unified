#!/usr/bin/env node
import http from "node:http";
import readline from "node:readline";
import { SERVER_INFO, TOOLS, dispatchToolCall, handleMcpRequest } from "./src/mcp-handler.mjs";

const env = process.env;

if (process.argv.includes("--stdio")) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
      return;
    }

    const { id = null, method, params = {} } = msg;
    if (method === "notifications/initialized") return;

    if (method === "initialize") {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: params.protocolVersion || "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          },
        }) + "\n",
      );
      return;
    }

    if (method === "tools/list") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: TOOLS } }) + "\n");
      return;
    }

    if (method === "tools/call") {
      try {
        const data = await dispatchToolCall(params.name, params.arguments || {}, env);
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
          }) + "\n",
        );
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] },
          }) + "\n",
        );
      }
      return;
    }

    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }) + "\n",
    );
  });
} else {
  const port = Number(env.PORT || 8788);
  const host = env.HOST || "127.0.0.1";
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const webReq = new Request(`http://${host}:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
    });
    const webRes = await handleMcpRequest(webReq, env);
    res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
    const text = await webRes.text();
    res.end(text);
  });

  server.listen(port, host, () => {
    console.error(`reqbin-rest-mcp listening on http://${host}:${port}/mcp`);
  });
}
