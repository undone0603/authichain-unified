import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guardrailCheck, guardrailRecord } from './guardrail-client';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.INTERNAL_API_SECRET = 'test-secret';
  process.env.GUARDRAIL_API_URL = 'https://guardrail.test';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('guardrailCheck', () => {
  it('returns allowed:true when the API allows the send', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, remaining: 12 }),
    });

    const result = await guardrailCheck('email.b2b-cold', { recipient: 'a@example.com' });

    expect(result).toEqual({ allowed: true, remaining: 12 });
  });

  it('sends the channel, count, and recipient in the request body with the internal secret header', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, remaining: 5 }),
    });

    await guardrailCheck('email.b2b-cold', { count: 2, recipient: 'a@example.com' });

    expect(fetch).toHaveBeenCalledWith(
      'https://guardrail.test/api/guardrail/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-internal-secret': 'test-secret' }),
        body: JSON.stringify({ channel: 'email.b2b-cold', count: 2, recipient: 'a@example.com' }),
      }),
    );
  });

  it('fails closed when the API explicitly denies, and does not mark it as an error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false, remaining: 0, reason: 'daily cap reached' }),
    });

    const result = await guardrailCheck('email.b2b-cold');

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'daily cap reached', errored: false });
  });

  // A policy denial (cap reached, channel disabled, recipient suppressed) and an
  // infrastructure failure of the check call itself both resolve to allowed:false,
  // but callers need to tell them apart: a policy denial should just queue the
  // send for later, while an infra failure means the guardrail can't be reached
  // at all and should trip the caller's own send-failure/non-zero-exit tracking
  // rather than silently look like a healthy, capped-out run.
  it('marks an unreachable/erroring check as errored:true (distinct from a policy denial)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await guardrailCheck('email.b2b-cold');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/503/);
    expect(result.errored).toBe(true);
  });

  it('marks a network error as errored:true', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await guardrailCheck('email.b2b-cold');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/ECONNREFUSED/);
    expect(result.errored).toBe(true);
  });

  it('marks a missing INTERNAL_API_SECRET as errored:true, without calling fetch', async () => {
    delete process.env.INTERNAL_API_SECRET;

    const result = await guardrailCheck('email.b2b-cold');

    expect(result.allowed).toBe(false);
    expect(result.errored).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('guardrailRecord', () => {
  it('posts the event to the record endpoint', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await guardrailRecord({ channel: 'email.b2b-cold', action: 'record', allowed: true, reason: 'sent' });

    expect(fetch).toHaveBeenCalledWith(
      'https://guardrail.test/api/guardrail/record',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ channel: 'email.b2b-cold', action: 'record', allowed: true, reason: 'sent' }),
      }),
    );
  });

  it('never throws when the record call fails (best-effort logging only)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      guardrailRecord({ channel: 'email.b2b-cold', action: 'record', allowed: true }),
    ).resolves.toBeUndefined();
  });

  it('never throws when INTERNAL_API_SECRET is not configured, without calling fetch', async () => {
    delete process.env.INTERNAL_API_SECRET;

    await expect(
      guardrailRecord({ channel: 'email.b2b-cold', action: 'record', allowed: true }),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
