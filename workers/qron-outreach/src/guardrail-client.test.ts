import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guardrailCheck, guardrailRecord, guardrailSuppress } from './guardrail-client';

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { INTERNAL_API_SECRET: 'test-secret', GUARDRAIL_API_URL: 'https://guardrail.test', ...overrides };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('guardrailCheck', () => {
  it('returns allowed:true when the API allows the send', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, remaining: 9 }),
    });

    const result = await guardrailCheck(makeEnv(), 'email.qron-outreach', { recipient: 'a@example.com' });

    expect(result).toEqual({ allowed: true, remaining: 9 });
  });

  it('sends the channel, count, and recipient in the request body with the internal secret header', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ allowed: true, remaining: 1 }) });

    await guardrailCheck(makeEnv(), 'email.qron-outreach', { count: 1, recipient: 'a@example.com' });

    expect(fetch).toHaveBeenCalledWith(
      'https://guardrail.test/api/guardrail/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-internal-secret': 'test-secret' }),
        body: JSON.stringify({ channel: 'email.qron-outreach', count: 1, recipient: 'a@example.com' }),
      }),
    );
  });

  it('fails closed when the API explicitly denies, and does not mark it as an error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false, remaining: 0, reason: 'channel disabled' }),
    });

    const result = await guardrailCheck(makeEnv(), 'email.qron-outreach');

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'channel disabled', errored: false });
  });

  it('marks an unreachable/erroring check as errored:true', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await guardrailCheck(makeEnv(), 'email.qron-outreach');

    expect(result.allowed).toBe(false);
    expect(result.errored).toBe(true);
  });

  it('marks a network error as errored:true', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await guardrailCheck(makeEnv(), 'email.qron-outreach');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/ECONNREFUSED/);
    expect(result.errored).toBe(true);
  });

  it('marks a missing INTERNAL_API_SECRET as errored:true, without calling fetch', async () => {
    const result = await guardrailCheck(makeEnv({ INTERNAL_API_SECRET: undefined }), 'email.qron-outreach');

    expect(result.allowed).toBe(false);
    expect(result.errored).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('guardrailRecord', () => {
  it('posts the event to the record endpoint', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await guardrailRecord(makeEnv(), { channel: 'email.qron-outreach', action: 'record', allowed: true, reason: 'sent' });

    expect(fetch).toHaveBeenCalledWith(
      'https://guardrail.test/api/guardrail/record',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ channel: 'email.qron-outreach', action: 'record', allowed: true, reason: 'sent' }),
      }),
    );
  });

  it('never throws when the record call fails (best-effort logging only)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      guardrailRecord(makeEnv(), { channel: 'email.qron-outreach', action: 'record', allowed: true }),
    ).resolves.toBeUndefined();
  });

  it('never throws when INTERNAL_API_SECRET is not configured, without calling fetch', async () => {
    await expect(
      guardrailRecord(makeEnv({ INTERNAL_API_SECRET: undefined }), { channel: 'email.qron-outreach', action: 'record', allowed: true }),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('guardrailSuppress', () => {
  it('posts the suppression to the suppress endpoint', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await guardrailSuppress(makeEnv(), 'bad@example.com', 'bounced', 'qron-outreach-webhook');

    expect(fetch).toHaveBeenCalledWith(
      'https://guardrail.test/api/guardrail/suppress',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'bad@example.com', reason: 'bounced', source: 'qron-outreach-webhook' }),
      }),
    );
  });

  it('never throws when the suppress call fails (best-effort logging only)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      guardrailSuppress(makeEnv(), 'bad@example.com', 'bounced', 'qron-outreach-webhook'),
    ).resolves.toBeUndefined();
  });

  it('never throws when INTERNAL_API_SECRET is not configured, without calling fetch', async () => {
    await expect(
      guardrailSuppress(makeEnv({ INTERNAL_API_SECRET: undefined }), 'bad@example.com', 'bounced', 'qron-outreach-webhook'),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
