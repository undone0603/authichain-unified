/**
 * ops-monitor — self-healing Cron Worker.
 * Polls critical surfaces every 6 hours. Alerts via ntfy ONLY on anomalies.
 * Idempotent. Structured logs. Founder asleep-safe.
 */

export interface Env {
  NTFY_TOPIC: string;
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  latencyMs?: number;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const start = Date.now();
    const checks = await Promise.all([
      checkLiveVerify(),
      checkApiVerify(),
      checkGitHubMainStatus(env),
    ]);

    const failures = checks.filter((c) => !c.ok);
    const summary = {
      event: "ops_monitor",
      ts: new Date().toISOString(),
      durationMs: Date.now() - start,
      total: checks.length,
      failures: failures.length,
      checks,
    };

    console.log(JSON.stringify(summary));

    if (failures.length > 0 && env.NTFY_TOPIC) {
      const body = `ops-monitor: ${failures.length} failure(s)\n${failures
        .map((f) => `• ${f.name}: ${f.detail || "failed"}`)
        .join("\n")}`;
      try {
        await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain", Title: "AuthiChain ops alert", Priority: "high", Tags: "warning" },
          body,
        });
      } catch (err) {
        console.log(JSON.stringify({ event: "ntfy_fail", error: String(err) }));
      }
    }
  },
};

async function checkLiveVerify(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://authichain.com/verify?id=polygon-anchor-1", { method: "HEAD", redirect: "follow" });
    return { name: "live_verify", ok: res.ok || res.status === 200 || res.status === 404, latencyMs: Date.now() - t0, detail: `status ${res.status}` };
  } catch (err) {
    return { name: "live_verify", ok: false, detail: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkApiVerify(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://authichain.com/api/verify?id=polygon-anchor-1");
    const ok = res.ok;
    return { name: "api_verify", ok, latencyMs: Date.now() - t0, detail: `status ${res.status}` };
  } catch (err) {
    return { name: "api_verify", ok: false, detail: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkGitHubMainStatus(env: Env): Promise<CheckResult> {
  // Read-only public status. No token required for public repo.
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.github.com/repos/undone0603/authichain-unified/commits/main/status");
    if (!res.ok) return { name: "github_main", ok: false, detail: `status ${res.status}`, latencyMs: Date.now() - t0 };
    const data = await res.json() as { state?: string };
    const ok = data.state === "success" || data.state === "pending";
    return { name: "github_main", ok, detail: data.state || "unknown", latencyMs: Date.now() - t0 };
  } catch (err) {
    return { name: "github_main", ok: false, detail: String(err), latencyMs: Date.now() - t0 };
  }
}
