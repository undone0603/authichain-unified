/**
 * Daily revenue-cycle Cron Worker.
 * Read-only: public rails check (Starter + DPP checkout) + decision log.
 * Never sends mail, never creates Stripe sessions, no secrets required.
 * Cron: 0 13 * * * UTC (08:30 America/Detroit).
 */

interface Env {}

const DEFAULT_ORIGIN = "https://authichain.com";
const STARTER_CHECKOUT_PATH = "/checkout/starter";
const DPP_CHECKOUT_PATH = "/checkout/dpp_readiness";
const DPP_HEAD_PATH = "/api/checkout/dpp";

type RailsResult = {
  id: string;
  url: string;
  method: "GET" | "HEAD";
  status: number;
  ok: boolean;
  detail?: string;
};

async function checkMoneyRails(origin = DEFAULT_ORIGIN): Promise<{ ok: boolean; reason: string; results: RailsResult[] }> {
  const base = origin.replace(/\/+$/, "");
  const steps = [
    { id: "starter_checkout", url: `${base}${STARTER_CHECKOUT_PATH}`, method: "GET" as const, accept: [200] },
    { id: "dpp_checkout", url: `${base}${DPP_CHECKOUT_PATH}`, method: "GET" as const, accept: [200] },
    { id: "dpp_head", url: `${base}${DPP_HEAD_PATH}`, method: "HEAD" as const, accept: [204] },
  ];

  const results: RailsResult[] = [];
  for (const step of steps) {
    try {
      const res = await fetch(step.url, { method: step.method, redirect: "manual" });
      const ok = step.accept.includes(res.status);
      results.push({
        id: step.id,
        url: step.url,
        method: step.method,
        status: res.status,
        ok,
        detail: ok ? undefined : `expected ${step.accept.join("|")}, got ${res.status}`,
      });
    } catch (err) {
      results.push({
        id: step.id,
        url: step.url,
        method: step.method,
        status: 0,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const failed = results.filter(r => !r.ok);
  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "Starter $29 and DPP $299 checkout rails up" : failed.map(f => `${f.id}: ${f.detail ?? "failed"}`).join("; "),
    results,
  };
}

export default {
  async scheduled(_event: ScheduledEvent, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const start = Date.now();
        const rails = await checkMoneyRails();
        const action = rails.ok ? "wait_buyer" : "fix_rails";
        const reason = rails.reason;
        const log = {
          event: "revenue_cycle_ran",
          ts: new Date().toISOString(),
          action,
          reason,
          rails_ok: rails.ok,
          duration_ms: Date.now() - start,
          results: rails.results,
        };
        console.log(JSON.stringify(log));
        // Optional: POST to ntfy.sh if secret is later added. Not required for v1.
      })()
    );
  },

  async fetch() {
    return new Response("revenue-cycle cron worker — scheduled only", { status: 200 });
  },
};
