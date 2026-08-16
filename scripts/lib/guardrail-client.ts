/**
 * Client for the guardrail/caps layer (see
 * docs/superpowers/specs/2026-07-29-guardrail-caps-layer-design.md).
 * Every automation channel must call guardrailCheck before an external-effect
 * action and guardrailRecord after. Fails closed: a missing secret, an
 * unreachable API, a non-ok HTTP response, or any response that isn't
 * exactly { allowed: true } is treated as denied.
 */

const DEFAULT_BASE_URL = 'https://app.authichain.com';
const TIMEOUT_MS = 5000;

export interface GuardrailCheckResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
  /**
   * True when `allowed:false` came from the check call itself failing
   * (missing secret, unreachable API, non-ok HTTP) rather than the server
   * explicitly denying the request (cap reached, channel disabled,
   * suppressed recipient). Callers should route `errored:true` into their
   * own failure/alerting path — an infra outage should not look identical
   * to a routine policy denial.
   */
  errored?: boolean;
}

export interface GuardrailRecordInput {
  channel: string;
  action: 'check' | 'record' | 'suppress' | 'kill_toggle';
  allowed?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

function baseUrl(): string {
  return process.env.GUARDRAIL_API_URL ?? DEFAULT_BASE_URL;
}

export async function guardrailCheck(
  channel: string,
  opts: { count?: number; recipient?: string } = {},
): Promise<GuardrailCheckResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { allowed: false, remaining: 0, reason: 'INTERNAL_API_SECRET not configured', errored: true };
  }

  try {
    const res = await fetch(`${baseUrl()}/api/guardrail/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ channel, count: opts.count ?? 1, recipient: opts.recipient }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { allowed: false, remaining: 0, reason: `guardrail check HTTP ${res.status}`, errored: true };
    }

    const data = (await res.json()) as Partial<GuardrailCheckResult>;
    if (data.allowed !== true) {
      // The server responded successfully and explicitly denied — a policy
      // decision, not an error.
      return { allowed: false, remaining: data.remaining ?? 0, reason: data.reason ?? 'denied', errored: false };
    }
    return { allowed: true, remaining: data.remaining ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { allowed: false, remaining: 0, reason: `guardrail check failed: ${message}`, errored: true };
  }
}

export async function guardrailRecord(input: GuardrailRecordInput): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn(`[guardrail] INTERNAL_API_SECRET not configured — skipping record for ${input.channel}`);
    return;
  }

  try {
    const res = await fetch(`${baseUrl()}/api/guardrail/record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[guardrail] record HTTP ${res.status} for ${input.channel}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[guardrail] record failed for ${input.channel}: ${message}`);
  }
}
