#!/usr/bin/env node
/**
 * No-payment Glama MCP protocol smoke. Runs ONLY metadata calls and one
 * non-binding quote. It intentionally does not call paid "verify", create a
 * checkout, include a wallet proof, or run any customer-facing mutation.
 *
 * Usage:
 *   node scripts/ci/glama-mcp-free-smoke.mjs
 *   REQUIRE_MCP_HINTS=1 node scripts/ci/glama-mcp-free-smoke.mjs
 *
 * No credentials are accepted or loaded. A successful GET alone is not
 * sufficient: this check also exercises the JSON-RPC POST transport.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MCP_URL = "https://authichain.com/mcp";
export const EXPECTED_TOOLS = [
  "get_pricing",
  "verify",
  "query_provenance",
  "verify_attestation",
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
  "negotiate",
];
export const SAFE_READ_ONLY = EXPECTED_TOOLS.filter(name => name !== "verify");
const PROTOCOL_VERSION = "2025-06-18";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(fetchImpl, url, init, label) {
  const response = await fetchImpl(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  ensure(response.status === 200, label + " returned HTTP " + response.status);
  const type = response.headers.get("content-type") ?? "";
  ensure(type.includes("application/json"), label + " is not a JSON response: " + type);
  return response.json();
}

async function jsonRpc(fetchImpl, url, id, method, params) {
  ensure(
    ["initialize", "tools/list", "tools/call"].includes(method),
    "Unallowlisted method"
  );
  if (method === "tools/call") {
    ensure(params?.name === "negotiate", "Only nonbinding negotiate is allowed");
    ensure(params.arguments?.service === "verify_record", "Quote must target free verify_record");
    ensure(params.arguments?.mode === "quote_only", "Quote must remain nonbinding");
  }
  const payload = { jsonrpc: "2.0", id, method, params };
  const result = await fetchJson(
    fetchImpl,
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
      },
      body: JSON.stringify(payload),
    },
    method
  );
  ensure(result.jsonrpc === "2.0" && result.id === id, method + " returned mismatched JSON-RPC id");
  ensure(result.result && !result.error, method + " returned JSON-RPC error");
  return result.result;
}

export async function runFreeMcpSmoke({
  fetchImpl = fetch,
  url = MCP_URL,
  requireHints = false,
  log = console.log,
} = {}) {
  // No override should make an accidental paid call; allow local mock tests,
  // but pin the live CLI to the exact published endpoint.
  const u = new URL(url);
  ensure(
    (u.protocol === "https:" || u.hostname === "localhost") &&
      u.pathname === "/mcp" && !u.username && !u.password && !u.search,
    "Refusing unexpected MCP endpoint"
  );
  const startedAt = new Date().toISOString();
  const discovery = await fetchJson(fetchImpl, url, { method: "GET" }, "GET discovery");
  ensure(discovery.serverInfo?.version, "GET discovery omitted server version");
  const discoveredNames = (discovery.tools ?? []).map(tool => tool.name);
  ensure(
    JSON.stringify(discoveredNames.slice().sort()) === JSON.stringify(EXPECTED_TOOLS.slice().sort()),
    "Discovery tool list differs from eight expected names"
  );
  log("PASS GET discovery, version " + discovery.serverInfo.version + ", tools " + discoveredNames.length);

  const initialized = await jsonRpc(fetchImpl, url, 1, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "authichain-glama-free-smoke", version: "1.0.0" },
  });
  ensure(initialized.protocolVersion === PROTOCOL_VERSION, "initialize negotiated unexpected protocol");
  ensure(initialized.serverInfo?.version === discovery.serverInfo.version, "GET and POST server versions differ");
  log("PASS POST initialize " + initialized.protocolVersion);

  const listed = await jsonRpc(fetchImpl, url, 2, "tools/list", {});
  const toolMap = new Map((listed.tools ?? []).map(tool => [tool.name, tool]));
  ensure(toolMap.size === EXPECTED_TOOLS.length, "tools/list tool count mismatch");
  for (const name of EXPECTED_TOOLS) ensure(toolMap.has(name), "Missing tool " + name);
  if (requireHints) {
    for (const name of SAFE_READ_ONLY) {
      ensure(toolMap.get(name).annotations?.readOnlyHint === true, name + " missing readOnlyHint=true");
      ensure(toolMap.get(name).annotations?.destructiveHint === false, name + " missing destructiveHint=false");
    }
    ensure(toolMap.get("verify").annotations?.readOnlyHint === false, "Paid verify lacks readOnlyHint=false");
  }
  log("PASS POST tools/list, tools " + toolMap.size + ", hints " + (requireHints ? "required" : "optional"));

  const quote = await jsonRpc(fetchImpl, url, 3, "tools/call", {
    name: "negotiate",
    arguments: { service: "verify_record", mode: "quote_only" },
  });
  const body = quote.structuredContent ??
    JSON.parse(quote.content?.find(item => item.type === "text")?.text ?? "{}");
  ensure(body.service === "verify_record", "Quote returned different service");
  ensure(body.payment_authorized === false && body.settled === false, "Quote unexpectedly authorized or settled");
  ensure(body.binding === false && body.side_effects === false, "Quote unexpectedly binding or side-effecting");
  ensure(body.price_usd === 0, "Free verification quote is not free");
  log("PASS POST tools/call negotiate — free, nonbinding, no settlement");

  return {
    ok: true,
    checkedAtUtc: startedAt,
    endpoint: url,
    serverVersion: initialized.serverInfo.version,
    protocolVersion: initialized.protocolVersion,
    toolCount: toolMap.size,
    paidCalls: 0,
    settlementAttempts: 0,
    hintsRequired: requireHints,
  };
}

async function main() {
  // The CLI is pinned, never accepts a payment-bearing URL or credential.
  const result = await runFreeMcpSmoke({
    url: MCP_URL,
    requireHints: process.env.REQUIRE_MCP_HINTS === "1",
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("FAIL glama-mcp-free-smoke: " + error.message);
    process.exitCode = 1;
  });
}
