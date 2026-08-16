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

/**
 * Credentials to try, in order. The estate has two Resend accounts holding
 * different verified domains — measured 2026-08-16:
 *
 *   RESEND_API_KEY   → strainchain.io
 *   RESEND_API_KEY2  → authichain.com
 *
 * Which key can send from a given address is therefore not knowable from the
 * address alone. Rather than hand-maintaining a domain→key table that silently
 * drifts whenever a domain moves between accounts, the sender check probes the
 * candidates and reports which one Resend actually accepted.
 */
export const CREDENTIAL_ENV_VARS = ['RESEND_API_KEY', 'RESEND_API_KEY2'] as const;
export type CredentialName = (typeof CREDENTIAL_ENV_VARS)[number];

export interface SenderCheck {
  ok: boolean;
  from: string;
  /**
   * Env var holding the credential that can send from `from`. The name, not
   * the value — callers read the secret themselves so it is never carried
   * around in a return value or logged by accident.
   */
  credential?: CredentialName;
  /** Human-readable failure cause, absent when ok. */
  reason?: string;
  /**
   * Distinguishes the failure modes so callers can report them differently: a
   * bad key breaks every channel at once and needs a secret rotation, while an
   * unverified sender breaks only the channels using that From address and
   * needs the domain added to one of the accounts.
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

/** One probe send with one credential. */
async function probe(from: string, credential: CredentialName): Promise<SenderCheck> {
  const key = process.env[credential];
  if (!key) {
    return { ok: false, from, reason: `${credential} is not set`, kind: 'invalid_key' };
  }

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

    if (res.ok) return { ok: true, from, credential };

    // Resend error bodies carry no secret material, so the message is safe
    // to surface verbatim into CI logs.
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const message = body.message ?? `HTTP ${res.status}`;
    return { ok: false, from, reason: message, kind: classify(res.status, message) };
  } catch (err: any) {
    return { ok: false, from, reason: err?.message ?? 'network error', kind: 'unreachable' };
  }
}

/**
 * Finds a credential that can send from `from`, by attempting one throwaway
 * send per candidate. A success proves the key authenticates *and* owns the
 * sending domain — the two conditions every real send depends on.
 *
 * On total failure the most actionable diagnosis wins: if some account
 * recognised the key but rejected the domain, that is an
 * `unverified_sender` problem (add the domain), which is more specific than
 * the `invalid_key` a missing second secret would otherwise report.
 */
export async function checkSender(from: string): Promise<SenderCheck> {
  const cached = cache.get(from);
  if (cached) return cached;

  const failures: SenderCheck[] = [];
  let result: SenderCheck | undefined;

  for (const credential of CREDENTIAL_ENV_VARS) {
    const attempt = await probe(from, credential);
    if (attempt.ok) {
      result = attempt;
      break;
    }
    failures.push(attempt);
    // A network problem is not evidence about the other credential, and
    // retrying through a broken path just doubles the wait.
    if (attempt.kind === 'unreachable') break;
  }

  result ??=
    failures.find(f => f.kind === 'unverified_sender') ??
    failures.find(f => f.kind === 'unreachable') ??
    failures[0] ?? { ok: false, from, reason: 'no credentials configured', kind: 'invalid_key' };

  cache.set(from, result);
  return result;
}

/** Emits a GitHub Actions error annotation with the fix for this failure mode. */
export function reportSenderFailure(check: SenderCheck, channel: string): void {
  console.error(`::error::[${channel}] sender preflight failed for ${check.from}: ${check.reason}`);

  switch (check.kind) {
    case 'invalid_key':
      console.error(
        `::error::No usable Resend credential (${CREDENTIAL_ENV_VARS.join(', ')}). Generate a key ` +
          'at https://resend.com/api-keys and store it with the "Set Outreach Secret" workflow.',
      );
      break;
    case 'unverified_sender':
      console.error(
        `::error::The domain of ${check.from} is not verified on any configured Resend account. ` +
          'Verify it at https://resend.com/domains, or point OUTREACH_FROM_EMAIL / EMAIL_FROM at ' +
          'a domain that already is. Run "Verify Outreach Secrets" with probe_matrix to see which ' +
          'key owns which domain.',
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
