#!/usr/bin/env node
/**
 * Independent, read-only MCP dual-protocol probe. No credentials, tools/call,
 * money, signatures, notifications beyond the legacy initialized handshake,
 * or redirect following. Requires Node 20+.
 *
 * MCP_URL=https://authichain.com/mcp node scripts/interop/mcp-dual-protocol-readonly.mjs
 * Results reflect the actual target deployment, NOT the current draft branch.
 */
const endpoint = process.env.MCP_URL || "https://authichain.com/mcp";
const parsedUrl = new URL(endpoint);
if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
  throw Error("Only unauthenticated HTTPS endpoints may be probed");
}
const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "authichain-readonly-independent-probe",
    version: "0.2.0",
  },
};
const observations = [];
const runStartedAt = new Date().toISOString();
async function probe(label, headers, message, expectedStatus) {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(12000),
  });
  const raw = await response.text();
  if (raw.length > 1_000_000) throw Error("Response exceeded read-only probe size limit");
  let frame;
  try {
    frame = raw ? JSON.parse(raw) : null;
  } catch {
    frame = null;
  }
  const result = frame?.result ?? {};
  const observation = {
    label,
    httpStatus: response.status,
    expectedStatus,
    protocolVersion: response.headers.get("MCP-Protocol-Version"),
    resultType: result.resultType ?? null,
    supportedVersions: result.supportedVersions ?? null,
    cacheScope: result.cacheScope ?? null,
    ttlMs: result.ttlMs ?? null,
    tools: Array.isArray(result.tools) ? result.tools.map(tool => tool.name) : [],
    negotiatedLegacyVersion: result.protocolVersion ?? null,
    rpcErrorCode: frame?.error?.code ?? null,
    redirectBlocked: response.status >= 300 && response.status < 400,
    jsonDecoded: frame !== null,
  };
  observations.push(observation);
  return observation;
}

const modernHeaders = { "MCP-Protocol-Version": "2026-07-28" };
const legacyHeaders = { "MCP-Protocol-Version": "2025-06-18" };
let outcome = "incomplete";
try {
  await probe(
    "modern-discover",
    { ...modernHeaders, "Mcp-Method": "server/discover" },
    { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: modernMeta } },
    200
  );
  await probe(
    "modern-tools-list",
    { ...modernHeaders, "Mcp-Method": "tools/list" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: modernMeta } },
    200
  );
  await probe(
    "legacy-initialize",
    legacyHeaders,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "authichain-readonly-independent-probe", version: "0.2.0" },
      },
    },
    200
  );
  await probe(
    "legacy-initialized-notification",
    legacyHeaders,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    202
  );
  await probe(
    "legacy-tools-list",
    legacyHeaders,
    { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} },
    200
  );
  const discover = observations[0];
  const modern = observations[1];
  const legacyInit = observations[2];
  const legacyNotification = observations[3];
  const legacyList = observations[4];
  const modernPass =
    discover.httpStatus === 200 &&
    discover.resultType === "complete" &&
    discover.supportedVersions?.includes("2026-07-28") &&
    discover.cacheScope === "private" &&
    discover.ttlMs === 0 &&
    modern.httpStatus === 200 &&
    modern.resultType === "complete" &&
    modern.cacheScope === "private" &&
    modern.ttlMs === 0 &&
    modern.tools.length > 0;
  const legacyPass =
    legacyInit.httpStatus === 200 &&
    legacyInit.negotiatedLegacyVersion === "2025-06-18" &&
    legacyNotification.httpStatus === 202 &&
    legacyList.httpStatus === 200 &&
    legacyList.tools.length > 0;
  outcome = modernPass && legacyPass ? "pass" : "fail";
} catch (error) {
  observations.push({ label: "transport-error", error: String(error) });
}
console.log(JSON.stringify({
  target: endpoint,
  executedAt: runStartedAt,
  completedAt: new Date().toISOString(),
  runtime: process.version,
  sourceRevision: process.env.SOURCE_SHA || "not-supplied",
  outcome,
  observations,
  statusMeaning: outcome === "incomplete" ? "Transport failure; protocol compatibility not evaluated" : outcome === "fail" ? "Observed responses did not satisfy this probe\u0027s expected assertions" : "All probe assertions satisfied on this target",
  note: "Read-only wire observations. No tool execution, paid settlement or independent certification.",
}, null, 2));
if (outcome !== "pass") process.exitCode = 1;
