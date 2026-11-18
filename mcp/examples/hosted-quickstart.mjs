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
  if (!text) {
    return { ok: true, status: response.status, error: null, data: null };
  }

  const data = JSON.parse(text);
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

async function main() {
  const result = await runHostedQuickstart();
  console.log(JSON.stringify(result, null, 2));
  if (!result.connected || !result.toolCallOk) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
