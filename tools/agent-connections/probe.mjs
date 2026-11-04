/**
 * Read-only MCP + A2A connection preflight against AuthiChain's own origin.
 * No arbitrary URL input (avoids SSRF), no tool execution, no A2A message,
 * no x402 signature, no keys, no paid checkout, no external peer pairing.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const MCP_URL = "https://authichain.com/mcp";
export const AGENT_CARD_URL = "https://authichain.com/.well-known/agent-card.json";
export const A2A_ENDPOINT = "https://authichain.com/api/a2a";
const SUPPORTED_MCP = "2025-06-18";
const ACCEPT = "application/json, text/event-stream";
const MAX_RESPONSE_BYTES = 128 * 1024;

async function readJsonLimited(response) {
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("EXPECTED_JSON_RESPONSE");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("RESPONSE_TOO_LARGE");
  if (!response.body) throw new Error("EMPTY_RESPONSE");
  let bytes = 0;
  const parts = [];
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_RESPONSE_BYTES) throw new Error("RESPONSE_TOO_LARGE");
    parts.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

function assertMcpAnswer(body, id) {
  if (!body || body.jsonrpc !== "2.0" || body.id !== id || body.error) {
    throw new Error("MCP_JSONRPC_MISMATCH");
  }
  return body.result;
}

export function assessMcpHandshake(init, listed) {
  const issues = [];
  if (init?.serverInfo?.name !== "authichain") issues.push("MCP_SERVER_IDENTITY_UNEXPECTED");
  if (!Array.isArray(listed?.tools)) issues.push("MCP_TOOLS_MISSING");
  else {
    const names = new Set(listed.tools.map(t => t?.name));
    if (!names.has("verify_record")) issues.push("MCP_FREE_VERIFIER_MISSING");
    if (!names.has("get_agent_setup_offers")) {
      issues.push("SETUP_OFFERS_NOT_DEPLOYED");
    }
  }
  return {
    technical_status: issues.length ? "review_required" : "compatible",
    issues,
    issuer_attested: false,
    paid_call_executed: false,
    tools_called: false,
  };
}

export function assessA2aCard(card) {
  const issues = [];
  if (card?.name !== "AuthiChain") issues.push("CARD_NAME_UNEXPECTED");
  const interfaces = Array.isArray(card?.supportedInterfaces)
    ? card.supportedInterfaces : [];
  const interfaceMatch = interfaces.some(i =>
    i?.protocolBinding === "JSONRPC" &&
    String(i?.protocolVersion || "").startsWith("1.0") &&
    i?.url === A2A_ENDPOINT
  );
  if (!interfaceMatch) issues.push("A2A_1_0_INTERFACE_NOT_DECLARED");
  if (!Array.isArray(card?.skills) || card.skills.length === 0) {
    issues.push("NO_PUBLIC_SKILLS");
  }
  return {
    technical_status: issues.length ? "review_required" : "compatible",
    issues,
    peer_approval_verified: false,
    task_sent: false,
    trust_established: false,
  };
}

/** Can only probe fixed AuthiChain URLs; fetchImpl injectable for offline tests. */
export async function probeAuthichainConnections({ fetchImpl = fetch } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: ACCEPT,
  };
  const initRes = await fetchImpl(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-init-probe",
      method: "initialize",
      params: {
        protocolVersion: SUPPORTED_MCP,
        capabilities: {},
        clientInfo: { name: "authichain-readonly-preflight", version: "0.1" },
      },
    }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const init = assertMcpAnswer(await readJsonLimited(initRes), "mcp-init-probe");
  const version = init?.protocolVersion;
  if (version !== SUPPORTED_MCP && version !== "2025-03-26") {
    throw new Error("UNSUPPORTED_NEGOTIATED_MCP_VERSION");
  }
  const sessionId = initRes.headers.get("mcp-session-id");
  const listRes = await fetchImpl(MCP_URL, {
    method: "POST",
    headers: {
      ...headers,
      "MCP-Protocol-Version": version,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-tools-probe",
      method: "tools/list",
      params: {},
    }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const list = assertMcpAnswer(await readJsonLimited(listRes), "mcp-tools-probe");
  const cardRes = await fetchImpl(AGENT_CARD_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const card = await readJsonLimited(cardRes);
  return {
    schema: "authichain-peer-preflight/1",
    endpoints: { mcp: MCP_URL, agentCard: AGENT_CARD_URL, a2a: A2A_ENDPOINT },
    mcp: assessMcpHandshake(init, list),
    a2a: assessA2aCard(card),
    connection: "AUTHICHAIN_ENDPOINTS_ONLY_NOT_EXTERNAL_PEER_CONNECTED",
    permissions: {
      thirdPartyCredentials: false,
      taskMessaging: false,
      payment: false,
      outboundSending: false,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await probeAuthichainConnections();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (
      result.mcp.technical_status !== "compatible" ||
      result.a2a.technical_status !== "compatible"
    ) process.exitCode = 2;
  } catch (err) {
    console.error(err instanceof Error ? err.message : "preflight_failed");
    process.exitCode = 1;
  }
}
