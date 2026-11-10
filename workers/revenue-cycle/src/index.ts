/**
 * Revenue Cycle Worker
 * Implements .grok/workflows/revenue-cycle.rhai and .grok/skills/revenue-operator.
 * Daily weekday cron applies read-only money-rails check + decision.
 *
 * Cron (UTC): 30 12 * * 1-5  → ~08:30 America/Detroit (EST). Adjust for EDT if needed.
 *
 * Observability:
 *   - Structured JSON logs on every run
 *   - Alert (console.error + optional ntfy) when action === "fix_rails"
 *   - Optional KV for result history (idempotent by date)
 *
 * Never sends mail. Never creates a Stripe session. Founder is removed from the loop.
 */

export interface Env {
  REVENUE_LOG?: KVNamespace;
  NTFY_TOPIC?: string;
}

interface RailsResult {
  id: string;
  status: number;
  ok: boolean;
  detail?: string;
}

async function checkMoneyRails(): Promise<{ ok: boolean; reason: string; results: RailsResult[] }> {
  const origin = "https://authichain.com";
  const steps = [
    { id: "starter_checkout", url: `${origin}/checkout/starter`, method: "GET" as const, accept: [200] },
    { id: "dpp_checkout", url: `${origin}/checkout/dpp_readiness`, method: "GET" as const, accept: [200] },
    { id: "dpp_head", url: `${origin}/api/checkout/dpp`, method: "HEAD" as const, accept: [204] },
  ];

  const results: RailsResult[] = [];
  for (const step of steps) {
    try {
      const res = await fetch(step.url, { method: step.method, redirect: "manual" });
      const ok = step.accept.includes(res.status);
      results.push({
        id: step.id,
        status: res.status,
        ok,
        detail: ok ? undefined : `expected ${step.accept.join("|")}, got ${res.status}`,
      });
    } catch (err) {
      results.push({
        id: step.id,
        status: 0,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = results.filter(r => !r.ok);
  return {
    ok: failed.length === 0,
    reason:
      failed.length === 0
        ? "Starter $29 and DPP $299 checkout rails up"
        : failed.map(f => `${f.id}: ${f.detail ?? "failed"}`).join("; "),
    results,
  };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const start = Date.now();

    console.log(
      JSON.stringify({
        event: "revenue-cycle-start",
        date: dateKey,
        cron: event.cron,
        skill: "revenue-operator",
        ts: start,
      })
    );

    const rails = await checkMoneyRails();

    // Full classifyRevenue requires a live Stripe snapshot.
    // Per skill + rhai default when no snapshot is supplied: wait_buyer unless rails fail.
    // Future: fetch internal /api/internal/revenue-snapshot (secret-protected) or use Stripe key.
    const action = rails.ok ? "wait_buyer" : "fix_rails";
    const result = {
      action,
      reason: rails.reason,
      sent: false,
      date: dateKey,
      railsOk: rails.ok,
      results: rails.results,
      durationMs: Date.now() - start,
    };

    console.log(JSON.stringify({ event: "revenue-cycle-decision", ...result }));

    if (action === "fix_rails") {
      console.error(JSON.stringify({ alert: "revenue-rails-down", reason: rails.reason, date: dateKey }));
      if (env.NTFY_TOPIC) {
        ctx.waitUntil(
          fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
            method: "POST",
            body: `Revenue rails down: ${rails.reason}`,
            headers: {
              Title: "AuthiChain revenue-cycle",
              Priority: "high",
              Tags: "warning,money",
            },
          }).catch(err => console.error("ntfy failed", String(err)))
        );
      }
    }

    if (env.REVENUE_LOG) {
      ctx.waitUntil(
        env.REVENUE_LOG.put(
          `revenue-cycle:${dateKey}`,
          JSON.stringify(result),
          { expirationTtl: 60 * 60 * 24 * 30 }
        ).catch(err => console.error("kv put failed", String(err)))
      );
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        worker: "revenue-cycle",
        skill: "revenue-operator",
        cron: "30 12 * * 1-5 UTC (~08:30 America/Detroit)",
      });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      // Manual trigger for testing. Idempotent by date.
      const rails = await checkMoneyRails();
      const action = rails.ok ? "wait_buyer" : "fix_rails";
      return Response.json({
        action,
        reason: rails.reason,
        sent: false,
        railsOk: rails.ok,
        results: rails.results,
      });
    }

    return new Response(
      "revenue-cycle worker — applies Grok revenue-operator skill (read-only)",
      { status: 200, headers: { "content-type": "text/plain" } }
    );
  },
};
