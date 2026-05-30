// AuthiChain Infrastructure Monitor
// Cron: every 6h — health checks, alert on degradation, report to KV + email

interface Env {
  INFRA_KV: KVNamespace;
  AUTH_TOKEN: string;
  STRIPE_SECRET_KEY: string;
  GITHUB_TOKEN?: string;
  ALERT_EMAIL: string;
  RESEND_RELAY: string;
}

interface CheckResult {
  name: string;
  url?: string;
  status: 'ok' | 'warn' | 'down' | 'skip';
  latencyMs?: number;
  detail?: string;
}

interface InfraReport {
  timestamp: string;
  checks: CheckResult[];
  alertsSent: string[];
  summary: { ok: number; warn: number; down: number };
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

// ── Health checks ────────────────────────────────────────────────────────────

const SERVICE_ENDPOINTS: { name: string; url: string; expectStatus?: number }[] = [
  { name: 'authichain-api', url: 'https://authichain-api.undone-k.workers.dev/health' },
  { name: 'qron-automation', url: 'https://qron-automation.undone-k.workers.dev/health' },
  { name: 'qron-outreach', url: 'https://qron-outreach.undone-k.workers.dev/health' },
  { name: 'resend-relay', url: 'https://resend-relay.undone-k.workers.dev/health' },
  { name: 'qron-portfolio', url: 'https://qron-portfolio.undone-k.workers.dev/' },
  { name: 'qron.space', url: 'https://qron.space/' },
  { name: 'authichain.com', url: 'https://authichain.com/' },
  { name: 'strainchain.io', url: 'https://strainchain.io/' },
  { name: 'qron-seo-engine (sitemap)', url: 'https://qron.space/sitemap.xml' },
  { name: 'stripe-webhook (next.js)', url: 'https://authichain.com/api/webhook', expectStatus: 405 },
];

async function checkEndpoint(endpoint: typeof SERVICE_ENDPOINTS[0]): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(endpoint.url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'authichain-infra/1.0' }
    });
    const latencyMs = Date.now() - t0;
    const expectedStatus = endpoint.expectStatus ?? 200;
    const ok = res.status === expectedStatus || (res.status >= 200 && res.status < 400 && !endpoint.expectStatus);
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: ok ? 'ok' : 'warn',
      latencyMs,
      detail: ok ? `HTTP ${res.status}` : `HTTP ${res.status} (expected ${expectedStatus})`
    };
  } catch (e: any) {
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 'down',
      latencyMs: Date.now() - t0,
      detail: e.message ?? 'fetch error'
    };
  }
}

async function checkStripeWebhook(env: Env): Promise<CheckResult> {
  if (!env.STRIPE_SECRET_KEY) return { name: 'stripe-webhook-config', status: 'skip', detail: 'no STRIPE_SECRET_KEY' };
  try {
    const res = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=5', {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    if (!res.ok) return { name: 'stripe-webhook-config', status: 'warn', detail: `Stripe API ${res.status}` };
    const data: any = await res.json();
    const endpoints: any[] = data.data ?? [];
    const correctEndpoint = endpoints.find(
      (e: any) => e.url === 'https://authichain.com/api/webhook' && e.status === 'enabled'
    );
    if (correctEndpoint) {
      const events = correctEndpoint.enabled_events ?? [];
      return {
        name: 'stripe-webhook-config',
        status: 'ok',
        detail: `${events.length} events, id: ${correctEndpoint.id}`
      };
    }
    const anyMatch = endpoints.find((e: any) => e.url.includes('authichain.com'));
    if (anyMatch) {
      return {
        name: 'stripe-webhook-config',
        status: anyMatch.status === 'enabled' ? 'ok' : 'warn',
        detail: `found ${anyMatch.url} status=${anyMatch.status}`
      };
    }
    return {
      name: 'stripe-webhook-config',
      status: 'warn',
      detail: `No webhook pointing to authichain.com — found: ${endpoints.map((e: any) => e.url).join(', ') || 'none'}`
    };
  } catch (e: any) {
    return { name: 'stripe-webhook-config', status: 'down', detail: e.message };
  }
}

async function checkGitHubBranches(env: Env): Promise<CheckResult> {
  if (!env.GITHUB_TOKEN) return { name: 'github-stale-branches', status: 'skip', detail: 'no GITHUB_TOKEN' };
  try {
    const res = await fetch('https://api.github.com/repos/undone-k/authichain-unified/branches', {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'authichain-infra'
      }
    });
    if (!res.ok) return { name: 'github-stale-branches', status: 'warn', detail: `GitHub API ${res.status}` };
    const branches: any[] = await res.json();
    const stale = branches.filter((b: any) => !['main'].includes(b.name)).map((b: any) => b.name);
    return {
      name: 'github-stale-branches',
      status: stale.length > 3 ? 'warn' : 'ok',
      detail: stale.length === 0 ? 'clean' : `stale: ${stale.join(', ')}`
    };
  } catch (e: any) {
    return { name: 'github-stale-branches', status: 'down', detail: e.message };
  }
}

async function checkGitHubDependabot(env: Env): Promise<CheckResult> {
  if (!env.GITHUB_TOKEN) return { name: 'dependabot-alerts', status: 'skip', detail: 'no GITHUB_TOKEN' };
  try {
    const res = await fetch('https://api.github.com/repos/undone-k/authichain-unified/dependabot/alerts?state=open&per_page=50', {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'authichain-infra'
      }
    });
    if (res.status === 403) return { name: 'dependabot-alerts', status: 'skip', detail: 'no Dependabot access (enable in repo settings)' };
    if (!res.ok) return { name: 'dependabot-alerts', status: 'warn', detail: `GitHub API ${res.status}` };
    const alerts: any[] = await res.json();
    const bySeverity: Record<string, number> = {};
    for (const a of alerts) {
      const sev = a.security_advisory?.severity ?? 'unknown';
      bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    }
    const highCritical = (bySeverity['critical'] ?? 0) + (bySeverity['high'] ?? 0);
    return {
      name: 'dependabot-alerts',
      status: highCritical > 0 ? 'warn' : alerts.length > 0 ? 'warn' : 'ok',
      detail: alerts.length === 0 ? 'none' : Object.entries(bySeverity).map(([k, v]) => `${v} ${k}`).join(', ')
    };
  } catch (e: any) {
    return { name: 'dependabot-alerts', status: 'down', detail: e.message };
  }
}

async function checkKVConnectivity(env: Env): Promise<CheckResult> {
  try {
    const probe = `probe_${Date.now()}`;
    await env.INFRA_KV.put('_connectivity_probe', probe, { expirationTtl: 60 });
    const val = await env.INFRA_KV.get('_connectivity_probe');
    return {
      name: 'infra-kv',
      status: val === probe ? 'ok' : 'warn',
      detail: val === probe ? 'read/write ok' : 'write succeeded but read mismatch'
    };
  } catch (e: any) {
    return { name: 'infra-kv', status: 'down', detail: e.message };
  }
}

// ── Core run ────────────────────────────────────────────────────────────────

async function runChecks(env: Env): Promise<InfraReport> {
  const timestamp = new Date().toISOString();

  // Service health checks (parallel)
  const serviceResults = await Promise.all(SERVICE_ENDPOINTS.map(checkEndpoint));

  // Deeper checks
  const [stripeResult, kvResult, branchResult, dependabotResult] = await Promise.all([
    checkStripeWebhook(env),
    checkKVConnectivity(env),
    checkGitHubBranches(env),
    checkGitHubDependabot(env),
  ]);

  const checks: CheckResult[] = [...serviceResults, stripeResult, kvResult, branchResult, dependabotResult];

  const summary = checks.reduce(
    (acc, c) => {
      if (c.status === 'ok') acc.ok++;
      else if (c.status === 'warn') acc.warn++;
      else if (c.status === 'down') acc.down++;
      return acc;
    },
    { ok: 0, warn: 0, down: 0 }
  );

  const alertsSent: string[] = [];

  // Alert if anything is down or high severity
  const problems = checks.filter(c => c.status === 'down' || c.status === 'warn');
  if (problems.length > 0) {
    const prevRaw = await env.INFRA_KV.get('last_alert_hash');
    const currentHash = JSON.stringify(problems.map(p => p.name + p.status)).length.toString();
    if (prevRaw !== currentHash) {
      const subject = `[AuthiChain Infra] ${summary.down} down, ${summary.warn} warn — ${timestamp.slice(0, 10)}`;
      const body = [
        `Infrastructure check: ${summary.ok} ok / ${summary.warn} warn / ${summary.down} down`,
        '',
        '--- Problems ---',
        ...problems.map(p => `[${p.status.toUpperCase()}] ${p.name}: ${p.detail ?? ''}`),
        '',
        '--- All checks ---',
        ...checks.map(c => `[${c.status}] ${c.name}${c.latencyMs ? ` (${c.latencyMs}ms)` : ''}: ${c.detail ?? ''}`),
        '',
        `Run at: ${timestamp}`,
        `Dashboard: https://authichain-infra.undone-k.workers.dev/status`
      ].join('\n');

      const emailRes = await fetch(env.RESEND_RELAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: env.ALERT_EMAIL,
          subject,
          text: body,
          from: 'AuthiChain Infra <hello@authichain.com>',
          reply_to: env.ALERT_EMAIL
        })
      });
      if (emailRes.ok) {
        alertsSent.push(env.ALERT_EMAIL);
        await env.INFRA_KV.put('last_alert_hash', currentHash, { expirationTtl: 86400 });
      }
    }
  } else {
    // All clear — clear the alert dedup key so next degradation fires fresh
    await env.INFRA_KV.delete('last_alert_hash');
  }

  const report: InfraReport = { timestamp, checks, alertsSent, summary };
  await env.INFRA_KV.put('latest_report', JSON.stringify(report), { expirationTtl: 86400 * 7 });

  // Append to history ring (keep last 24 entries)
  const histRaw = await env.INFRA_KV.get('report_history');
  const hist: InfraReport[] = histRaw ? JSON.parse(histRaw) : [];
  hist.unshift(report);
  hist.splice(24);
  await env.INFRA_KV.put('report_history', JSON.stringify(hist), { expirationTtl: 86400 * 30 });

  return report;
}

// ── HTTP handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'authichain-infra', ts: new Date().toISOString() });
    }

    const authToken = env.AUTH_TOKEN;
    const isAuthed = !!authToken && (
      timingSafeEqual(url.searchParams.get('key') ?? '', authToken) ||
      timingSafeEqual(request.headers.get('Authorization') ?? '', `Bearer ${authToken}`)
    );
    if (!isAuthed) return new Response('Unauthorized', { status: 401 });

    if (url.pathname === '/run') {
      const report = await runChecks(env);
      return Response.json(report);
    }

    if (url.pathname === '/status') {
      const raw = await env.INFRA_KV.get('latest_report');
      if (!raw) return Response.json({ error: 'No report yet — hit /run first' }, { status: 404 });
      const report: InfraReport = JSON.parse(raw);
      const statusEmoji = (s: string) => s === 'ok' ? '✅' : s === 'warn' ? '⚠️' : s === 'down' ? '🔴' : '⏭';
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>AuthiChain Infra Status</title>
<style>
  body{font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:2rem;margin:0}
  h1{color:#d4a017;margin:0 0 .25rem}
  .ts{color:#666;font-size:.85rem;margin-bottom:2rem}
  table{border-collapse:collapse;width:100%;max-width:900px}
  th{color:#999;text-align:left;padding:.4rem .75rem;border-bottom:1px solid #222;font-size:.8rem;text-transform:uppercase}
  td{padding:.5rem .75rem;border-bottom:1px solid #1a1a1a}
  .ok{color:#22c55e} .warn{color:#f59e0b} .down{color:#ef4444} .skip{color:#666}
  .summary{margin-bottom:1.5rem;display:flex;gap:1.5rem;font-size:1.1rem}
  .num{font-size:1.4rem;font-weight:bold}
</style></head><body>
<h1>AuthiChain Infra</h1>
<div class="ts">Last check: ${report.timestamp}</div>
<div class="summary">
  <div><div class="num ok">${report.summary.ok}</div>OK</div>
  <div><div class="num warn">${report.summary.warn}</div>Warn</div>
  <div><div class="num down">${report.summary.down}</div>Down</div>
</div>
<table>
<tr><th>Check</th><th>Status</th><th>Latency</th><th>Detail</th></tr>
${report.checks.map(c => `<tr>
  <td>${c.url ? `<a href="${c.url}" style="color:#888;text-decoration:none">${c.name}</a>` : c.name}</td>
  <td class="${c.status}">${statusEmoji(c.status)} ${c.status}</td>
  <td style="color:#555">${c.latencyMs != null ? c.latencyMs + 'ms' : '—'}</td>
  <td style="color:#999">${c.detail ?? ''}</td>
</tr>`).join('')}
</table>
<div style="margin-top:2rem;color:#555;font-size:.8rem">
  <a href="?key=${url.searchParams.get('key')}&_r=${Date.now()}" style="color:#d4a017">↻ Refresh</a>
  &nbsp;·&nbsp;
  <a href="/run?key=${url.searchParams.get('key')}" style="color:#d4a017">▶ Run now</a>
</div>
</body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/history') {
      const raw = await env.INFRA_KV.get('report_history');
      if (!raw) return Response.json([]);
      return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(
      `AuthiChain Infra Monitor\n\nEndpoints:\n  /health             — public\n  /run?key=TOKEN      — trigger check now\n  /status?key=TOKEN   — HTML dashboard\n  /history?key=TOKEN  — last 24 reports (JSON)`,
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runChecks(env));
  }
};
