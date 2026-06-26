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
});
