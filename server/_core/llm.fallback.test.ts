import { describe, it, expect } from 'vitest';
import { shouldFallBackFromAnthropic } from './llm';

/**
 * The fallback's value depends entirely on it being narrow.
 *
 * Too narrow and the pipeline stalls behind a billing action, which is what
 * prompted it. Too wide and a malformed request quietly succeeds against a
 * second provider, turning a loud bug into a subtle one — the same shape of
 * silent failure this codebase has been dug out of repeatedly.
 */

const anthropicError = (status: number, body = '') =>
  new Error(`Anthropic API error: ${status} Bad Request – ${body}`);

describe('shouldFallBackFromAnthropic', () => {
  it('falls back when the credit balance is exhausted', () => {
    // The case this exists for. It arrives as a 400, so status alone is not
    // enough to tell it apart from a malformed request.
    expect(
      shouldFallBackFromAnthropic(
        anthropicError(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'),
      ),
    ).toBe(true);
  });

  it('does NOT fall back on an ordinary 400', () => {
    // A malformed payload must keep failing loudly. Retrying it against a more
    // forgiving provider would hide the bug and produce output from a model
    // nobody chose.
    expect(shouldFallBackFromAnthropic(anthropicError(400, '{"error":{"message":"max_tokens: must be >= 1"}}'))).toBe(
      false,
    );
  });

  it('falls back when the key is missing entirely', () => {
    expect(shouldFallBackFromAnthropic(new Error('ANTHROPIC_API_KEY is not configured'))).toBe(true);
  });

  it.each([401, 402, 403, 408, 429, 500, 502, 503, 504])(
    'falls back on %i — the provider is unreachable, not the request wrong',
    status => {
      expect(shouldFallBackFromAnthropic(anthropicError(status))).toBe(true);
    },
  );

  it.each([400, 404, 422])('does not fall back on %i', status => {
    expect(shouldFallBackFromAnthropic(anthropicError(status))).toBe(false);
  });

  it('does not fall back on an unrecognised error', () => {
    // Anything without a provider status is a local bug — a TypeError in the
    // conversion code, say — and must not be retried elsewhere.
    expect(shouldFallBackFromAnthropic(new TypeError('cannot read property of undefined'))).toBe(false);
  });

  it('matches quota wording regardless of status', () => {
    expect(shouldFallBackFromAnthropic(new Error('Anthropic API error: 400 – insufficient_quota'))).toBe(true);
  });
});
