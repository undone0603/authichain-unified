/**
 * Production smoke gate: money + verification path on authichain.com.
 * Read-only GETs. Does not create Stripe sessions or write funnel events.
 */
export type SmokeStep = {
  id: string;
  url: string;
  accept: number[];
};

export const DEFAULT_ORIGIN = "https://authichain.com";

export function smokeSteps(origin = DEFAULT_ORIGIN): SmokeStep[] {
  const base = origin.replace(/\/$/, "");
  return [
    { id: "origin", url: `${base}/`, accept: [200] },
    { id: "verification", url: `${base}/api/v1/verify`, accept: [400] },
    { id: "jwks", url: `${base}/protocol/jwks.json`, accept: [200] },
    { id: "issuer", url: `${base}/protocol/issuer.json`, accept: [200] },
    {
      id: "attestation",
      url: `${base}/api/v1/attestations/verify`,
      accept: [400, 405],
    },
    {
      id: "object_lookup",
      url: `${base}/api/v1/verify?serial=smoke-missing`,
      accept: [404],
    },
    { id: "checkout_surface", url: `${base}/pricing`, accept: [200] },
    { id: "checkout_api", url: `${base}/api/checkout`, accept: [405, 400] },
    { id: "provisioning", url: `${base}/api/v1/health`, accept: [200] },
    { id: "crm_status", url: `${base}/api/status`, accept: [200] },
  ];
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
  const res = await fetchImpl(step.url, {
    method: "GET",
    redirect: "follow",
    headers: { Accept: "application/json, text/html;q=0.8" },
  });
  const ok = step.accept.includes(res.status);
  let detail: string | undefined;
  if (step.id === "jwks" && ok) {
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
  if (!ok) detail = `expected ${step.accept.join("|")}, got ${res.status}`;
  return { id: step.id, url: step.url, status: res.status, ok, detail };
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
  const failed = results.filter(r => !r.ok);
  return { origin, results, ok: failed.length === 0, failed };
}

if (process.argv.includes("--run")) {
  const report = await runSmokeGate();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
