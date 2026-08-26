import { describe, it, expect } from 'vitest';
import { mapApolloEmailStatus } from './apollo-service';
import { assessRecipient, canSend } from './outreach/send-guard';

describe('mapApolloEmailStatus', () => {
  it('trusts only an explicit "verified"', () => {
    expect(mapApolloEmailStatus('verified')).toBe('apollo_verified');
  });

  it('treats a guessed address as a guess', () => {
    // Apollo infers these from the company's address format. They pass an MX
    // check because the domain is real, which is exactly the failure
    // send-guard.ts was written to prevent.
    expect(mapApolloEmailStatus('guessed')).toBe('pattern_guess');
  });

  it('refuses to trust anything it does not recognise', () => {
    // Fails closed, so a new or renamed Apollo status cannot silently become
    // sendable the day Apollo ships it.
    for (const status of ['unavailable', 'extrapolated', 'VERIFIED', '', null, undefined, 0, {}]) {
      expect(mapApolloEmailStatus(status)).toBe('unknown');
    }
  });
});

describe('the mapping composed with the send guard', () => {
  const assess = (status: unknown) =>
    canSend(assessRecipient('buyer@examplecorp.com', mapApolloEmailStatus(status)));

  it('lets a verified Apollo mailbox through', () => {
    expect(assess('verified')).toBe(true);
  });

  it('blocks a guessed one', () => {
    expect(assess('guessed')).toBe(false);
    expect(assess('unavailable')).toBe(false);
    expect(assess(undefined)).toBe(false);
  });

  it('still blocks a role inbox even when Apollo verified it', () => {
    // Provenance is necessary, not sufficient — info@ is never a decision-maker.
    const a = assessRecipient('info@examplecorp.com', mapApolloEmailStatus('verified'));
    expect(canSend(a)).toBe(false);
    expect(a.reasons).toContain('role_inbox');
  });
});
