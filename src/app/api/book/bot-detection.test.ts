import { describe, it, expect } from 'vitest';
import { detectBot, MIN_FILL_MS } from './bot-detection';

const human = {
  name: 'Hannah Melotto',
  email: 'hannah@example.com',
  company: 'Example Co',
  company_website: '',
  elapsed_ms: 42_000,
};

describe('detectBot', () => {
  it('lets a normal submission through', () => {
    expect(detectBot(human)).toBeNull();
  });

  it('catches a bot that fills the hidden decoy field', () => {
    expect(detectBot({ ...human, company_website: 'https://spam.example' })).toBe('honeypot_filled');
  });

  it('ignores whitespace-only decoy values', () => {
    expect(detectBot({ ...human, company_website: '   ' })).toBeNull();
  });

  it('catches a submission faster than a person could type', () => {
    expect(detectBot({ ...human, elapsed_ms: 120 })).toBe('submitted_too_fast');
  });

  it('accepts a submission exactly at the threshold', () => {
    expect(detectBot({ ...human, elapsed_ms: MIN_FILL_MS })).toBeNull();
  });

  it('prefers the honeypot reason when both signals fire', () => {
    expect(detectBot({ ...human, company_website: 'x', elapsed_ms: 5 })).toBe('honeypot_filled');
  });

  it('does not reject submissions with missing or malformed timing', () => {
    // Older cached page copies won't send elapsed_ms; dropping those would
    // discard real prospects. The honeypot still covers them.
    expect(detectBot({ ...human, elapsed_ms: undefined })).toBeNull();
    // The form sends null when submitted before the mount effect stamped a
    // start time.
    expect(detectBot({ ...human, elapsed_ms: null })).toBeNull();
    expect(detectBot({ ...human, elapsed_ms: 'fast' })).toBeNull();
    expect(detectBot({ ...human, elapsed_ms: NaN })).toBeNull();
  });
});
