import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { guardrailCheck, guardrailRecord, guardrailSuppress } = vi.hoisted(() => ({
  guardrailCheck: vi.fn(),
  guardrailRecord: vi.fn(),
  guardrailSuppress: vi.fn(),
}));
vi.mock('./guardrail-client', () => ({ guardrailCheck, guardrailRecord, guardrailSuppress }));

import { sendViaResend, handleBounceWebhook, type Email } from './index';

function makeEmail(overrides: Partial<Email> = {}): Email {
  return { to: 'prospect@example.com', name: 'Prospect', subject: 'Hi', body: 'body', ...overrides };
}

const env = {
  RESEND_API_KEY: 'resend-test-key',
  INTERNAL_API_SECRET: 'test-secret',
  AUTH_TOKEN: 'webhook-token',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  guardrailRecord.mockResolvedValue(undefined);
  guardrailSuppress.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendViaResend', () => {
  it('checks the guardrail before calling Resend, and calls Resend when allowed', async () => {
    guardrailCheck.mockResolvedValue({ allowed: true, remaining: 9 });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: 'resend-id-1' }) });

    const ok = await sendViaResend(makeEmail(), env);

    expect(ok).toBe(true);
    expect(guardrailCheck).toHaveBeenCalledWith(env, 'email.qron-outreach', { recipient: 'prospect@example.com' });
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.anything());
  });

  it('does not call Resend when the guardrail denies the send', async () => {
    guardrailCheck.mockResolvedValue({ allowed: false, remaining: 0, reason: 'channel disabled', errored: false });

    const ok = await sendViaResend(makeEmail(), env);

    expect(ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records the outcome after a successful send', async () => {
    guardrailCheck.mockResolvedValue({ allowed: true, remaining: 9 });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: 'resend-id-2' }) });

    await sendViaResend(makeEmail({ to: 'a@example.com' }), env);

    expect(guardrailRecord).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ channel: 'email.qron-outreach', action: 'record', allowed: true }),
    );
  });
});

describe('handleBounceWebhook', () => {
  it('calls guardrailSuppress with reason "bounced" for an email.bounced event', async () => {
    const request = new Request('https://example.com/webhook?key=webhook-token', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.bounced', data: { to: ['bad@example.com'] } }),
    });

    await handleBounceWebhook(request, env);

    expect(guardrailSuppress).toHaveBeenCalledWith(env, 'bad@example.com', 'bounced', 'qron-outreach-webhook');
  });

  it('calls guardrailSuppress with reason "complained" for an email.complained event', async () => {
    const request = new Request('https://example.com/webhook?key=webhook-token', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.complained', data: { to: ['angry@example.com'] } }),
    });

    await handleBounceWebhook(request, env);

    expect(guardrailSuppress).toHaveBeenCalledWith(env, 'angry@example.com', 'complained', 'qron-outreach-webhook');
  });

  it('does not call guardrailSuppress for an unrelated event type', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.delivered', data: { to: ['ok@example.com'] } }),
    });

    await handleBounceWebhook(request, env);

    expect(guardrailSuppress).not.toHaveBeenCalled();
  });

  it('does not globally suppress recipients from an unauthenticated webhook', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.bounced', data: { to: ['bad@example.com'] } }),
    });

    await handleBounceWebhook(request, env);

    expect(guardrailSuppress).not.toHaveBeenCalled();
  });
});
