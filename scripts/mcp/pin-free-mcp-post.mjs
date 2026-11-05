#!/usr/bin/env node
// Pinned, credential-free MCP POST reproduction for https://authichain.com/mcp/free
// Uses only public free tools. No API keys, no secrets, no redirects, no paid paths.
// Demo record "polygon-anchor-1" is the published demonstration (not a product).
// Fail-closed. Idempotent. Outputs structured JSON evidence.

import { createHash } from "node:crypto";

const ENDPOINT = "https://authichain.com/mcp/free";
const TIMEOUT_MS = 8000;
const DEMO_ID = "polygon-anchor-1";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function post(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: "error",
    });
    const text = await res.text();
    clearTimeout(timer);
    return { status: res.status, headers: Object.fromEntries(res.headers), text };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function main() {
  const started = new Date().toISOString();
  const evidence = {
    started_utc: started,
    endpoint: ENDPOINT,
    credentials_used: false,
    steps: [],
  };

  // tools/list
  const listBody = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  const list = await post(listBody);
  const listParsed = JSON.parse(list.text);
  evidence.steps.push({
    method: "tools/list",
    request: listBody,
    status: list.status,
    response_sha256: sha256(list.text),
    tools: listParsed.result?.tools?.map(t => t.name) ?? null,
  });
  if (list.status !== 200 || !listParsed.result?.tools?.some(t => t.name === "verify_record")) {
    evidence.ok = false;
    evidence.error = "tools/list missing verify_record or non-200";
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }

  // tools/call verify_record
  const callBody = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "verify_record", arguments: { id: DEMO_ID } },
  };
  const call = await post(callBody);
  const callParsed = JSON.parse(call.text);
  evidence.steps.push({
    method: "tools/call",
    tool: "verify_record",
    arguments: { id: DEMO_ID },
    request: callBody,
    status: call.status,
    response_sha256: sha256(call.text),
    result_preview: callParsed.result?.content?.[0]?.text?.slice(0, 400) ?? null,
  });

  evidence.ok = call.status === 200 && !!callParsed.result;
  evidence.finished_utc = new Date().toISOString();
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) process.exit(1);
}

main().catch(err => {
  console.log(JSON.stringify({ ok: false, error: String(err), credentials_used: false }, null, 2));
  process.exit(1);
});
