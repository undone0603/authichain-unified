/**
 * On-device input interpretation for the public AgentZ browser.
 * No image/audio payloads are sent here. SpeechRecognition availability and
 * on-device processing depend on the browser; the UI makes it opt-in.
 */
export type PublicAction = { action: 'offers' } | { action: 'verify'; id: string };

const SAFE_RECORD = /^[A-Za-z0-9_.:-]{1,200}$/;

export function voiceToPublicAction(transcript: string): PublicAction | null {
  const text = transcript.trim().replace(/[.!?]+$/, '').trim();
  if (/^(offers|(?:show|list)(?: the)?(?: public)? offers)$/i.test(text)) {
    return { action: 'offers' };
  }
  const verify = text.match(/^(?:verify|check)\s+(.+)$/i);
  if (verify && SAFE_RECORD.test(verify[1])) {
    return { action: 'verify', id: verify[1] };
  }
  return null;
}

/**
 * QR content is untrusted. Decode ONLY an exact AuthiChain public verifier URL.
 * No automatic navigation, arbitrary URL fetches, or verification verdicts.
 */
export function qrToPublicAction(raw: string): PublicAction | null {
  if (raw.length > 1024) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'authichain.com' ||
        url.port || url.username || url.password || url.hash ||
        url.pathname !== '/api/verify') return null;
    if ([...url.searchParams.keys()].some((key) => key !== 'id')) return null;
    const ids = url.searchParams.getAll('id');
    if (ids.length !== 1 || !SAFE_RECORD.test(ids[0])) return null;
    return { action: 'verify', id: ids[0] };
  } catch {
    return null;
  }
}

type Response = {
  action?: unknown;
  decision?: unknown;
  audit?: { authorized?: unknown };
  verify_url?: unknown;
  checkout_url?: unknown;
};

type Probe = { name: string; body: object; check: (response: Response) => boolean };

const PROBES: readonly Probe[] = [
  {
    name: 'Public catalogue',
    body: { action: 'offers' },
    check: (r) => r.action === 'offers' && r.decision === 'allow' &&
      r.audit?.authorized === true,
  },
  {
    name: 'Verifier is a link, not a verdict',
    body: { action: 'verify', id: 'polygon-anchor-1' },
    check: (r) => r.action === 'verify' && r.decision === 'allow' &&
      r.audit?.authorized === true &&
      r.verify_url === 'https://authichain.com/api/verify?id=polygon-anchor-1',
  },
  {
    name: 'Command execution refused',
    body: { prompt: 'EXECUTE sudo rm -rf /' },
    check: (r) => r.action === 'refuse' && r.decision === 'deny' &&
      r.audit?.authorized === false && r.checkout_url == null,
  },
];

export type SelfCheckReport = {
  passed: boolean;
  results: Array<{ name: string; passed: boolean }>;
};

/** Dogfood the real closed-capability endpoint; never trigger checkout or writes. */
export async function runPublicSelfCheck(
  request: (body: object) => Promise<unknown>
): Promise<SelfCheckReport> {
  const results: SelfCheckReport['results'] = [];
  for (const probe of PROBES) {
    let passed = false;
    try {
      const value = await request(probe.body);
      passed = value !== null && typeof value === 'object' &&
        probe.check(value as Response);
    } catch {
      passed = false;
    }
    results.push({ name: probe.name, passed });
  }
  return { passed: results.every((r) => r.passed), results };
}
