import { pathToFileURL } from "node:url";

async function postJsonRpc(fetchImpl, endpoint, payload) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `HTTP ${response.status}`,
      data: null,
    };
  }

  const text = await response.text();
  const expectsResponse = Object.hasOwn(payload, "id");
  if (!text && !expectsResponse) {
    return { ok: true, status: response.status, error: null, data: null };
  }

  const data = text ? JSON.parse(text) : null;
  if (
    expectsResponse &&
    (!data ||
      data.jsonrpc !== "2.0" ||
      data.id !== payload.id ||
      Object.hasOwn(data, "result") === Object.hasOwn(data, "error"))
  ) {
    return {
      ok: false,
      status: response.status,
      error: "Invalid or mismatched JSON-RPC response",
      data: null,
    };
  }
  if (data && data.error) {
    return {
      ok: false,
      status: response.status,
      error: data.error.message || JSON.stringify(data.error),
      data,
    };
  }

  return { ok: true, status: response.status, error: null, data };
}

export async function runHostedQuickstart({
  endpoint = "https://authichain.com/mcp",
  fetchImpl = fetch,
  protocolVersion = "2025-06-18",
} = {}) {
  try {
    const initRes = await postJsonRpc(fetchImpl, endpoint, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "authichain-hosted-quickstart", version: "1.0.0" },
      },
    });

    if (!initRes.ok) {
      return {
        connected: false,
        protocolVersion: null,
        tools: [],
        toolCallOk: false,
        classification: null,
        limitations: [initRes.error],
      };
    }

    const negotiatedVersion =
      initRes.data?.result?.protocolVersion ?? protocolVersion;

    const notifRes = await postJsonRpc(fetchImpl, endpoint, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    if (!notifRes.ok) {
      return {
        connected: false,
        protocolVersion: negotiatedVersion,
        tools: [],
        toolCallOk: false,
        classification: null,
        limitations: [notifRes.error],
      };
    }

    const listRes = await postJsonRpc(fetchImpl, endpoint, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    if (!listRes.ok) {
      return {
        connected: true,
        protocolVersion: negotiatedVersion,
        tools: [],
        toolCallOk: false,
        classification: null,
        limitations: [listRes.error],
      };
    }

    const tools = Array.isArray(listRes.data?.result?.tools)
      ? listRes.data.result.tools.map((t) => t.name).filter(Boolean)
      : [];

    if (!tools.includes("verify_record")) {
      return {
        connected: true,
        protocolVersion: negotiatedVersion,
        tools,
        toolCallOk: false,
        classification: null,
        limitations: ["verify_record was not advertised"],
      };
    }

    const callRes = await postJsonRpc(fetchImpl, endpoint, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "verify_record",
        arguments: { id: "polygon-anchor-1" },
      },
    });

    if (!callRes.ok || callRes.data?.result?.isError) {
      const errMsg = callRes.error || "verify_record returned isError";
      return {
        connected: true,
        protocolVersion: negotiatedVersion,
        tools,
        toolCallOk: false,
        classification: null,
        limitations: [errMsg],
      };
    }

    let parsed = null;
    const rawText = callRes.data?.result?.content?.[0]?.text;
    if (typeof rawText === "string") {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    const classification =
      parsed?.classification ??
      parsed?.verdict ??
      parsed?.protocolVerdict ??
      null;
    const limitations = Array.isArray(parsed?.limitations)
      ? parsed.limitations
      : Array.isArray(parsed?.reasons)
        ? parsed.reasons
        : [];

    return {
      connected: true,
      protocolVersion: negotiatedVersion,
      tools,
      toolCallOk: true,
      classification,
      limitations,
    };
  } catch (err) {
    return {
      connected: false,
      protocolVersion: null,
      tools: [],
      toolCallOk: false,
      classification: null,
      limitations: [err instanceof Error ? err.message : String(err)],
    };
  }
}

// --endpoint <url> wins over AUTHICHAIN_MCP_ENDPOINT; both fall back to the
// default above. Example: --endpoint https://authichain.com/mcp/free
export function endpointFromArgs(argv, env = {}) {
  const i = argv.indexOf("--endpoint");
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return env.AUTHICHAIN_MCP_ENDPOINT || undefined;
}

async function main() {
  const endpoint = endpointFromArgs(process.argv.slice(2), process.env);
  const result = await runHostedQuickstart(endpoint ? { endpoint } : {});
  console.log(JSON.stringify(result, null, 2));
  if (!result.connected || !result.toolCallOk) {
    process.exitCode = 1;
  } else if (result.classification !== "verified") {
    // The call worked but the published demo record did not verify (for
    // example anchor_not_on_chain:rpc_http_error). Exit non-zero so a smoke
    // test does not report a degraded verifier as healthy.
    console.error(
      `verify_record returned "${result.classification}", not "verified": ${result.limitations.join(", ")}`
    );
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
