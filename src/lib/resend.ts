// Lazy Resend client.
//
// `const resend = new Resend(process.env.RESEND_API_KEY)` at module scope throws
// "Missing API key" whenever the key is absent — which breaks `next build`
// ("collect page data" imports every route module) on Vercel preview deployments
// that don't carry the key. This proxy defers construction to first use at
// request time, so importing a route never requires the key at build time.

import { Resend } from 'resend';

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend = new Resend(key);
  return _resend;
}

/** Drop-in for an eagerly-constructed Resend client; real init on first use. */
export const resend: Resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const real = getResend() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
