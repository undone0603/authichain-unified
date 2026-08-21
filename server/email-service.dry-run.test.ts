import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The dry run exists so a person can be told "this is what a live tick would
 * send" and have that be true. Its whole value rests on sendEmail() never
 * reaching a provider while armed, so that is what these pin.
 *
 * fetch is spied on rather than stubbed to throw. A throwing stub looked
 * stricter but was worse: sendEmail catches a provider error and falls through
 * to SMTP, so the throw never reached the assertion, and it surfaced instead as
 * one unhandled error attributed to every test in the file. Counting calls says
 * the same thing without the collateral damage.
 */

const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: 'test-id' }), { status: 200 }));

vi.stubGlobal('fetch', fetchSpy);
vi.mock('./_core/env', () => ({
  ENV: {
    resendApiKey: 'test-key',
    resendFromEmail: 'noreply@authichain.com',
    gmailFromEmail: '',
    gmailAppPassword: '',
    suppressionList: 'blocked@example.com',
  },
}));

const { sendEmail, withDryRunEmail, isDryRun } = await import('./email-service');

const message = { to: 'someone@example.com', subject: 'Subject', body: 'Body text' };

beforeEach(() => fetchSpy.mockClear());
afterEach(() => expect(isDryRun(), 'dry run leaked past its scope').toBe(false));

describe('withDryRunEmail', () => {
  it('records the message instead of sending it', async () => {
    const { sends } = await withDryRunEmail(async () => sendEmail(message));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ to: 'someone@example.com', subject: 'Subject', body: 'Body text' });
  });

  it('reports dry_run rather than claiming the mail was sent', async () => {
    // A caller that logs status must not record a send that did not happen.
    const { result } = await withDryRunEmail(async () => sendEmail(message));
    expect(result.status).toBe('dry_run');
  });

  it('covers a caller that knows nothing about the dry run', async () => {
    // The point of putting this at the send boundary rather than threading a
    // flag: code written later is covered without having to opt in.
    const unawareModule = async () => {
      await sendEmail({ ...message, to: 'a@example.com' });
      await sendEmail({ ...message, to: 'b@example.com' });
    };

    const { sends } = await withDryRunEmail(unawareModule);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sends.map(s => s.to)).toEqual(['a@example.com', 'b@example.com']);
  });

  it('still reports suppression, because a live run would suppress too', async () => {
    // Recording a suppressed address as "would send" would overstate what a
    // live run does, which defeats the purpose.
    const { result, sends } = await withDryRunEmail(async () =>
      sendEmail({ ...message, to: 'blocked@example.com' }),
    );

    expect(result.status).toBe('suppressed');
    expect(sends).toHaveLength(0);
  });

  it('restores normal sending after the callback returns', async () => {
    await withDryRunEmail(async () => sendEmail(message));
    expect(isDryRun()).toBe(false);
  });

  it('restores normal sending even when the callback throws', async () => {
    // Without the finally, one thrown error would silently suppress every
    // outbound email for the rest of the process — a far worse failure than
    // the one that caused it.
    await expect(
      withDryRunEmail(async () => {
        await sendEmail(message);
        throw new Error('job blew up mid-tick');
      }),
    ).rejects.toThrow('job blew up mid-tick');

    expect(isDryRun()).toBe(false);
  });

  it('attempts the provider for real outside a dry run', async () => {
    // Guards the inverse mistake: a dry run that never disarms would look
    // exactly like a healthy system while delivering nothing.
    //
    // Asserts the network was *reached*, not that the call rejected —
    // sendEmail catches a provider failure and falls through to SMTP, so the
    // stub's throw never escapes. Reaching fetch is the thing being tested.
    await sendEmail(message);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
