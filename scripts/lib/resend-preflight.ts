/**
 * Sender preflight for every Resend-backed outreach channel.
 *
 * Why this exists: on 2026-08-10 the scheduled B2B outreach run walked its
 * entire prospect list and got `401 API key is invalid` on every single send.
 * The key stored in Actions had been superseded and nobody noticed, because the
 * failure only surfaced after the run had already burned through its targets.
 * A second, independent failure was stacked underneath it — the account has one
 * verified domain (strainchain.io) while both outreach scripts defaulted their
 * From address to @authichain.com, which cannot send at all.
 *
 * Both problems are invisible until a send is attempted, so we attempt one
 * up front. The probe goes to `delivered@resend.dev`, Resend's own test sink:
 * it accepts mail and reaches no real person, so it is safe to run on every
 * invocation. This mirrors the approach already used by
 * .github/workflows/verify-outreach-secrets.yml, which deliberately probes
 * sending rather than the /domains management endpoint — that endpoint's
 * status is ambiguous across full-access vs sending-only keys.
 */

const PROBE_RECIPIENT = 'delivered@resend.dev';
const TIMEOUT_MS = 10_000;

export interface SenderCheck {
  ok: boolean;
  from: string;
  /** Human-readable failure cause, absent when ok. */
  reason?: string;
  /**
   * Distinguishes the two failure modes so callers can report them
   * differently: a bad key breaks every channel at once and needs a secret
   * rotation, while an unverified domain breaks only the channels using that
   * From address and needs a DNS change.
   */
  kind?: 'invalid_key' | 'unverified_sender' | 'unreachable' | 'rejected';
}

/** Probe results are cached per address — segments often share a sender. */
const cache = new Map<string, SenderCheck>();

function classify(status: number, message: string): SenderCheck['kind'] {
  if (status === 401 || status === 403) {
    // Resend returns 403 for a From address whose domain isn't verified on
    // this account, and 401 when the key itself is bad or revoked.
    if (status === 401) return 'invalid_key';
    return /domain|from|verif/i.test(message) ? 'unverified_sender' : 'invalid_key';
  }
  return 'rejected';
}

/**
 * Attempts one throwaway send from `from`. Returns ok:true only when Resend
 * accepts it, which proves the key authenticates *and* the sending domain is
 * verified — the two conditions every real send depends on.
 */
export async function checkSender(from: string): Promise<SenderCheck> {
  const cached = cache.get(from);
  if (cached) return cached;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    const result: SenderCheck = {
      ok: false,
      from,
      reason: 'RESEND_API_KEY is not set',
      kind: 'invalid_key',
    };
    cache.set(from, result);
    return result;
  }

  let result: SenderCheck;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [PROBE_RECIPIENT],
        subject: 'AuthiChain outreach preflight',
        text: 'Automated sender check — no action needed.',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok) {
      result = { ok: true, from };
    } else {
      // Resend error bodies carry no secret material, so the message is safe
      // to surface verbatim into CI logs.
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      const message = body.message ?? `HTTP ${res.status}`;
      result = { ok: false, from, reason: message, kind: classify(res.status, message) };
    }
  } catch (err: any) {
    result = {
      ok: false,
      from,
      reason: err?.message ?? 'network error',
      kind: 'unreachable',
    };
  }

  cache.set(from, result);
  return result;
}

/** Emits a GitHub Actions error annotation with the fix for this failure mode. */
export function reportSenderFailure(check: SenderCheck, channel: string): void {
  console.error(`::error::[${channel}] sender preflight failed for ${check.from}: ${check.reason}`);

  switch (check.kind) {
    case 'invalid_key':
      console.error(
        '::error::RESEND_API_KEY is missing or no longer valid. Generate a key at ' +
          'https://resend.com/api-keys and store it with the "Set Outreach Secret" workflow.',
      );
      break;
    case 'unverified_sender':
      console.error(
        `::error::The domain of ${check.from} is not a verified sending domain on this Resend ` +
          'account. Verify it at https://resend.com/domains, or point OUTREACH_FROM_EMAIL / ' +
          'EMAIL_FROM at a domain that already is.',
      );
      break;
    default:
      console.error('::error::Resend was reachable but rejected the probe send.');
  }
}

/** Test seam — preflight caches aggressively, which would leak across cases. */
export function __resetSenderCache(): void {
  cache.clear();
}
