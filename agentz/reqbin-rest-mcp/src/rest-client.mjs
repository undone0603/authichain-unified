/**
 * ReqBin-REST core HTTP & MCP probe executor.
 * Zero-dependency Web Standard implementation for Cloudflare Workers and Node 18+.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
  /\.local$/i,
  /\.internal$/i,
];

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-internal-secret",
  "cookie",
  "set-cookie",
]);

export function parseAllowlist(env = {}) {
  const raw = env.REQBIN_ALLOWLIST || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function validateTargetUrl(rawUrl, env = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const allowHttp = String(env.ALLOW_INSECURE_HTTP || "").toLowerCase() === "true";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    throw new Error(`Blocked protocol "${parsed.protocol}" (only https: is allowed by default)`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowlist = parseAllowlist(env);
  if (!allowlist.has(hostname)) {
    for (const pattern of PRIVATE_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new Error(`Blocked private/loopback host "${hostname}" (add to REQBIN_ALLOWLIST to permit)`);
      }
    }
  }

  return parsed;
}

export function redactHeaders(headersObj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headersObj)) {
    out[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

export async function executeHttpRequest(params, env = {}, fetchImpl = globalThis.fetch) {
  const {
    method = "GET",
    url,
    headers = {},
    query,
    body,
    json,
    timeoutMs = 15000,
    followRedirects = true,
    maxBytes = 262144,
  } = params || {};

  if (!url || typeof url !== "string") {
    throw new Error("Missing required parameter: url");
  }

  const upperMethod = String(method).toUpperCase();
  const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
  if (!allowedMethods.has(upperMethod)) {
    throw new Error(`Unsupported HTTP method: ${upperMethod}`);
  }

  const parsedUrl = validateTargetUrl(url, env);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        parsedUrl.searchParams.set(k, String(v));
      }
    }
  }

  const clampedTimeout = Math.min(Math.max(Number(timeoutMs) || 15000, 500), 30000);
  const reqHeaders = new Headers(headers);
  if (!reqHeaders.has("User-Agent")) {
    reqHeaders.set("User-Agent", "agentz-reqbin-rest/1.0");
  }

  let reqBody;
  if (!["GET", "HEAD"].includes(upperMethod)) {
    if (json !== undefined) {
      reqBody = JSON.stringify(json);
      if (!reqHeaders.has("Content-Type")) {
        reqHeaders.set("Content-Type", "application/json");
      }
    } else if (body !== undefined) {
      reqBody = typeof body === "string" ? body : JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), clampedTimeout);
  const start = Date.now();

  try {
    const res = await fetchImpl(parsedUrl.toString(), {
      method: upperMethod,
      headers: reqHeaders,
      body: reqBody,
      redirect: followRedirects ? "follow" : "manual",
      signal: controller.signal,
    });

    const latencyMs = Date.now() - start;
    const rawText = upperMethod === "HEAD" ? "" : await res.text();
    const limit = Math.min(Math.max(Number(maxBytes) || 262144, 1024), 1048576);
    const truncated = rawText.length > limit;
    const text = truncated ? rawText.slice(0, limit) : rawText;

    let parsedJson = null;
    const contentType = res.headers.get("content-type") || "";
    if (!truncated && text && (contentType.includes("json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("["))) {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = null;
      }
    }

    const resHeaders = {};
    res.headers.forEach((value, key) => {
      resHeaders[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      latencyMs,
      url: res.url || parsedUrl.toString(),
      headers: resHeaders,
      body: parsedJson ? undefined : text,
      json: parsedJson,
      truncated,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function executeMcpProbe(params, env = {}, fetchImpl = globalThis.fetch) {
  const {
    url,
    mode = "full",
    toolName,
    toolArgs = {},
    headers = {},
    protocolVersion = "2025-06-18",
    timeoutMs = 15000,
  } = params || {};

  if (!url) throw new Error("Missing required parameter: url");

  const baseHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...headers,
  };

  const results = {};

  if (mode === "discovery") {
    results.discovery = await executeHttpRequest({ method: "GET", url, headers, timeoutMs }, env, fetchImpl);
    return results;
  }

  if (mode === "initialize" || mode === "full") {
    results.initialize = await executeHttpRequest(
      {
        method: "POST",
        url,
        headers: baseHeaders,
        timeoutMs,
        json: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: "reqbin-rest-mcp-probe", version: "1.0.0" },
          },
        },
      },
      env,
      fetchImpl,
    );
  }

  if (mode === "tools/list" || mode === "full") {
    results.toolsList = await executeHttpRequest(
      {
        method: "POST",
        url,
        headers: baseHeaders,
        timeoutMs,
        json: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      },
      env,
      fetchImpl,
    );
  }

  if (mode === "tools/call" || (mode === "full" && toolName)) {
    if (!toolName) throw new Error("toolName is required when mode is tools/call");
    results.toolsCall = await executeHttpRequest(
      {
        method: "POST",
        url,
        headers: baseHeaders,
        timeoutMs,
        json: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: toolName, arguments: toolArgs },
        },
      },
      env,
      fetchImpl,
    );
  }

  return results;
}

export async function executeBatchHealthCheck(params, env = {}, fetchImpl = globalThis.fetch) {
  const { urls = [], method = "GET", timeoutMs = 10000 } = params || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("urls must be a non-empty array");
  }
  if (urls.length > 10) {
    throw new Error("Maximum 10 URLs per batch_health_check");
  }

  const checks = await Promise.all(
    urls.map(async (targetUrl) => {
      try {
        const res = await executeHttpRequest(
          { method, url: targetUrl, timeoutMs, maxBytes: 4096 },
          env,
          fetchImpl,
        );
        return { url: targetUrl, ok: res.ok, status: res.status, latencyMs: res.latencyMs };
      } catch (err) {
        return { url: targetUrl, ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  return {
    checkedAt: new Date().toISOString(),
    total: checks.length,
    healthy: checks.filter((c) => c.ok).length,
    checks,
  };
}
