import { logActivity } from '../db.js';
import type { MissionTask } from '../../drizzle/schema.js';
type Task = MissionTask;

interface InfraPayload {
  domain?: string;
  url?: string;
}

export async function runCheckDnsConfig(task: Task): Promise<void> {
  const payload = task.payload as InfraPayload;
  const domain = payload.domain ?? 'authichain.com';

  const checks: { record: string; status: string; value?: string }[] = [];

  for (const type of ['A', 'AAAA', 'CNAME', 'MX', 'TXT']) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
      const data = await res.json() as { Status: number; Answer?: { data: string }[] };
      checks.push({
        record: type,
        status: data.Status === 0 ? 'ok' : 'error',
        value: data.Answer?.[0]?.data ?? undefined,
      });
    } catch {
      checks.push({ record: type, status: 'unreachable' });
    }
  }

  const failed = checks.filter(c => c.status !== 'ok');
  await logActivity({ userId: null, action: 'dns_config_checked', entityType: 'task', entityId: 0, details: { taskId: task.id,
    domain,
    checks,
    failedCount: failed.length,
    missionId: task.missionId,
  }});

  if (failed.length > 0) {
    throw new Error(`DNS check failed for ${failed.map(f => f.record).join(', ')} on ${domain}`);
  }
}

export async function runVerifySsl(task: Task): Promise<void> {
  const payload = task.payload as InfraPayload;
  const domain = payload.domain ?? 'authichain.com';
  const url = `https://${domain}`;

  let status = 'unknown';
  let statusCode: number | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
    statusCode = res.status;
    status = res.ok ? 'ok' : 'http_error';
  } catch (e) {
    status = 'ssl_or_network_error';
    error = String(e);
  }

  await logActivity({ userId: null, action: 'ssl_verified', entityType: 'task', entityId: 0, details: { taskId: task.id,
    domain,
    status,
    statusCode,
    error,
    missionId: task.missionId,
  }});

  if (status !== 'ok') {
    throw new Error(`SSL/connectivity check failed for ${domain}: ${status} ${error ?? ''}`);
  }
}

export async function runLighthouseAudit(task: Task): Promise<void> {
  const payload = task.payload as InfraPayload;
  const url = payload.url ?? 'https://authichain.com';

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=seo`;

  let scores: Record<string, number> = {};
  let error: string | null = null;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const data = await res.json() as {
        lighthouseResult?: { categories: Record<string, { score: number }> };
      };
      const cats = data.lighthouseResult?.categories ?? {};
      scores = Object.fromEntries(
        Object.entries(cats).map(([k, v]) => [k, Math.round(v.score * 100)])
      );
    } else {
      error = `PageSpeed API returned ${res.status}`;
    }
  } catch (e) {
    error = String(e);
  }

  await logActivity({ userId: null, action: 'lighthouse_audit_completed', entityType: 'task', entityId: 0, details: { taskId: task.id,
    url,
    scores,
    error,
    missionId: task.missionId,
  }});

  if (error) {
    throw new Error(`Lighthouse audit failed: ${error}`);
  }
}
