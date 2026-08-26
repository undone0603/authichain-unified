import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  assessRecipient, canSend, unsubscribeFooter, guardedSend,
} from './send-guard';

afterEach(() => { vi.restoreAllMocks(); delete process.env.RESEND_API_KEY; });

describe('assessRecipient (provenance guard)', () => {
  it('allows a well-formed address from a trusted source', () => {
    const a = assessRecipient('jane.doe@dispensary.com', 'apollo_verified');
    expect(a.status).toBe('allow');
    expect(canSend(a)).toBe(true);
  });

  it('REJECTS pattern-guessed C-suite (the fabricated-CRM problem)', () => {
    const a = assessRecipient('bernard.arnault@lvmh.com', 'pattern_guess');
    expect(a.status).toBe('reject');
    expect(a.reasons).toContain('untrusted_source:pattern_guess');
    expect(canSend(a)).toBe(false);
  });

  it('rejects scraped and unknown sources', () => {
    expect(assessRecipient('x@y.com', 'scraped').status).toBe('reject');
    expect(assessRecipient('x@y.com', 'unknown').status).toBe('reject');
  });

  it('rejects role/generic inboxes even from a trusted source', () => {
    const a = assessRecipient('info@crescolabs.com', 'inbound_optin');
    expect(a.status).toBe('reject');
    expect(a.reasons).toContain('role_inbox');
  });

  it('rejects malformed addresses', () => {
    expect(assessRecipient('not-an-email', 'confirmed_reply').status).toBe('reject');
  });
});

describe('unsubscribeFooter', () => {
  it('includes company, address, and an unsubscribe link', () => {
    const f = unsubscribeFooter({ company: 'AuthiChain', address: '123 Main St', unsubscribeUrl: 'https://x/u' });
    expect(f).toContain('AuthiChain');
    expect(f).toContain('123 Main St');
    expect(f).toContain('Unsubscribe: https://x/u');
  });
});

describe('guardedSend', () => {
  it('refuses a guessed recipient BEFORE any network call (no DNS, no send)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await guardedSend({
      to: 'bernard.arnault@lvmh.com', source: 'pattern_guess', subject: 's', body: 'b',
    });
    expect(r.sent).toBe(false);
    expect(r.reason).toContain('untrusted_source');
    expect(fetchSpy).not.toHaveBeenCalled(); // never touched the network
  });

  it('refuses a role inbox before any network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await guardedSend({
      to: 'info@crescolabs.com', source: 'inbound_optin', subject: 's', body: 'b',
    });
    expect(r.sent).toBe(false);
    expect(r.reason).toContain('role_inbox');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts an address the counterparty published itself', async () => {
    // A SAM.gov solicitation point-of-contact is published by its owner for
    // this exact purpose — categorically different from a plausible guess.
    const a = assessRecipient('john.doe@gsa.gov', 'published_contact');
    expect(canSend(a)).toBe(true);
  });

  describe('outbound request shape', () => {
    const OLD = { ...process.env };
    afterEach(() => { process.env = { ...OLD }; });

    async function captureSend(extra: Record<string, unknown> = {}) {
      process.env.RESEND_API_KEY = 're_test';
      process.env.MAILING_ADDRESS = '123 Main St, Detroit MI 48226';
      const fetchMock = vi.fn(async () => ({
        ok: true, status: 200, json: async () => ({ id: 'msg_1' }),
      }) as unknown as Response);
      vi.stubGlobal('fetch', fetchMock);
      // Domain gate is a DNS lookup; stub it to isolate the request shape.
      const dns = await import('node:dns');
      vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mx', priority: 1 }]);

      const r = await guardedSend({
        to: 'jane.doe@gsa.gov', source: 'published_contact',
        subject: 's', html: '<p>hi</p>', ...extra,
      });
      const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
      return { r, body };
    }

    it('sets reply-to and one-click List-Unsubscribe headers', async () => {
      const { body } = await captureSend();
      expect(body.reply_to).toBeTruthy();
      expect(body.headers['List-Unsubscribe']).toMatch(/^<https?:\/\//);
      expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('puts the postal address in the HTML part, not only the text part', async () => {
      // Nearly every recipient reads the HTML alternative; an address that
      // exists only in the text part is not compliant for them.
      const { body } = await captureSend();
      expect(body.html).toContain('123 Main St, Detroit MI 48226');
      expect(body.html).toContain('Unsubscribe');
    });

    it('sends with the caller-supplied credential, not the ambient one', async () => {
      process.env.RESEND_API_KEY = 're_account_one';
      const fetchMock = vi.fn(async () => ({
        ok: true, status: 200, json: async () => ({ id: 'msg_1' }),
      }) as unknown as Response);
      process.env.MAILING_ADDRESS = '123 Main St';
      vi.stubGlobal('fetch', fetchMock);
      const dns = await import('node:dns');
      vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mx', priority: 1 }]);

      await guardedSend({
        to: 'jane.doe@gsa.gov', source: 'published_contact',
        subject: 's', html: '<p>hi</p>', apiKey: 're_account_two',
      });
      const headers = (fetchMock.mock.calls[0] as any)[1].headers;
      // authichain.com lives on the second account — using the ambient key here
      // is exactly the bug that made every send from it fail.
      expect(headers.Authorization).toBe('Bearer re_account_two');
    });

    it('returns the Resend message id so callers can record it', async () => {
      const { r } = await captureSend();
      expect(r.sent).toBe(true);
      expect(r.id).toBe('msg_1');
    });

    it('fails closed when no postal address is configured', async () => {
      process.env.RESEND_API_KEY = 're_test';
      delete process.env.MAILING_ADDRESS;
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const dns = await import('node:dns');
      vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mx', priority: 1 }]);

      const r = await guardedSend({
        to: 'jane.doe@gsa.gov', source: 'published_contact', subject: 's', html: '<p>hi</p>',
      });
      expect(r.sent).toBe(false);
      expect(r.reason).toBe('mailing_address_not_configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
