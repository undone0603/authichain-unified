/**
 * Production smoke gate: live money + verification on authichain.com.
 * Read-only. HEAD on checkout 303s so this never creates a Stripe session.
 * Apex is Cloudflare-first: GET /api/checkout is JSON health (200), not 405.
 */
export type SmokeStep = {
  id: string;
  url: string;
  accept: number[];
  method?: "GET" | "HEAD" | "POST";
  jsonOk?: boolean;
  jsonReady?: boolean;
  /** JSON-RPC body; the step passes only if verify_record says "verified". */
  mcpVerify?: unknown;
};

export const DEFAULT_ORIGIN = "https://authichain.com";

// The published demo record. A healthy verifier reads its Polygon anchor and
// returns "verified"; anything else (e.g. anchor_not_on_chain:rpc_http_error)
// means the on-chain read is broken even though every page still serves 200.
export const MCP_VERIFY_CALL = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "verify_record", arguments: { id: "polygon-anchor-1" } },
};

export function smokeSteps(origin = DEFAULT_ORIGIN): SmokeStep[] {
  const base = origin.replace(/\/$/, "");
  return [
    { id: "origin", url: `${base}/`, accept: [200] },
    { id: "verify_surface", url: `${base}/verify`, accept: [200] },
    { id: "jwks", url: `${base}/protocol/jwks.json`, accept: [200] },
    { id: "issuer", url: `${base}/protocol/issuer.json`, accept: [200] },
    { id: "checkout_surface", url: `${base}/pricing`, accept: [200] },
    {
      id: "checkout_api",
      url: `${base}/api/checkout`,
      accept: [200],
      jsonOk: true,
    },
    {
      id: "checkout_dpp_head",
      url: `${base}/api/checkout/dpp`,
      accept: [204],
      method: "HEAD",
    },
    {
      id: "passport_head",
      url: `${base}/api/checkout/plan/strainchain_passport`,
      accept: [204],
      method: "HEAD",
    },
    {
      id: "farm_head",
      url: `${base}/api/checkout/plan/strainchain_farm`,
      accept: [204],
      method: "HEAD",
    },
    {
      id: "x402_health",
      url: `${base}/api/x402/health`,
      accept: [200],
      jsonReady: true,
    },
    {
      id: "mcp_verify_record",
      url: `${base}/mcp/free`,
      accept: [200],
      method: "POST",
      mcpVerify: MCP_VERIFY_CALL,
    },
  ];
}

function mcpVerdict(body: unknown): { verdict: unknown; reasons: unknown } {
  const text = (body as { result?: { content?: { text?: unknown }[] } })?.result
    ?.content?.[0]?.text;
  if (typeof text !== "string") return { verdict: null, reasons: [] };
  try {
    const parsed = JSON.parse(text) as { verdict?: unknown; reasons?: unknown };
    return { verdict: parsed.verdict ?? null, reasons: parsed.reasons ?? [] };
  } catch {
    return { verdict: null, reasons: [] };
  }
}

export type StepResult = {
  id: string;
  url: string;
  status: number;
  ok: boolean;
  detail?: string;
};

export async function runSmokeStep(
  step: SmokeStep,
  fetchImpl: typeof fetch = fetch
): Promise<StepResult> {
  const method = step.method || "GET";
  const res = await fetchImpl(step.url, {
    method,
    redirect: "manual",
    headers: step.mcpVerify
      ? {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        }
      : { Accept: "application/json, text/html;q=0.8" },
    ...(step.mcpVerify ? { body: JSON.stringify(step.mcpVerify) } : {}),
  });
  const okStatus = step.accept.includes(res.status);
  if (!okStatus) {
    return {
      id: step.id,
      url: step.url,
      status: res.status,
      ok: false,
      detail: `expected ${step.accept.join("|")}, got ${res.status}`,
    };
  }
  if (step.id === "jwks") {
    const body = (await res.clone().json()) as { keys?: unknown[] };
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      return {
        id: step.id,
        url: step.url,
        status: res.status,
        ok: false,
        detail: "JWKS missing keys",
      };
    }
  }
  if (step.mcpVerify) {
    const { verdict, reasons } = mcpVerdict(await res.clone().json());
    if (verdict !== "verified") {
      return {
        id: step.id,
        url: step.url,
        status: res.status,
        ok: false,
        detail: `verify_record returned ${JSON.stringify(verdict)}: ${
          Array.isArray(reasons) ? reasons.join(", ") : ""
        }`,
      };
    }
  }
  if (step.jsonOk || step.jsonReady) {
    const body = (await res.clone().json()) as {
      ok?: unknown;
      ready?: unknown;
    };
    if (step.jsonOk && body.ok !== true) {
      return {
        id: step.id,
        url: step.url,
        status: res.status,
        ok: false,
        detail: "checkout health missing ok:true",
      };
    }
    if (step.jsonReady && body.ready !== true) {
      return {
        id: step.id,
        url: step.url,
        status: res.status,
        ok: false,
        detail: "x402 health missing ready:true",
      };
    }
  }
  return { id: step.id, url: step.url, status: res.status, ok: true };
}

export async function runSmokeGate(
  origin = process.env.AUTHICHAIN_ORIGIN || DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch
) {
  const results: StepResult[] = [];
  for (const step of smokeSteps(origin)) {
    try {
      results.push(await runSmokeStep(step, fetchImpl));
    } catch (err) {
      results.push({
        id: step.id,
        url: step.url,
        status: 0,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const failed = results.filter(r => r.ok === false);
  return { origin, results, ok: failed.length === 0, failed };
}

if (process.argv.includes("--run")) {
  const report = await runSmokeGate();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
