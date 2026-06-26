import { describe, it, expect, vi, afterEach } from 'vitest';
import { inferEmailCandidates, verifyEmail, findVerifiedEmail } from './email-verify';

afterEach(() => vi.restoreAllMocks());

function mockReacher(byEmail: Record<string, { is_reachable: string; is_catch_all?: boolean }>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { to_email } = JSON.parse((init as RequestInit).body as string);
    const r = byEmail[to_email] ?? { is_reachable: 'invalid' };
    return { ok: true, json: async () => ({ is_reachable: r.is_reachable, smtp: { is_catch_all: r.is_catch_all ?? false } }) } as Response;
  });
}

describe('inferEmailCandidates', () => {
  it('generates ranked B2B patterns, first.last first', () => {
    const c = inferEmailCandidates('Jane', 'Doe', 'dispensary.com');
    expect(c[0]).toBe('jane.doe@dispensary.com');
    expect(c).toContain('jdoe@dispensary.com');
    expect(c).toContain('jane@dispensary.com');
  });

  it('cleans the domain (strips @, scheme, path) and lowercases names', () => {
    const c = inferEmailCandidates('Cory', 'Rothschild', 'https://CrescoLabs.com/about');
    expect(c[0]).toBe('cory.rothschild@crescolabs.com');
  });

  it('handles a missing last name', () => {
    expect(inferEmailCandidates('Madonna', '', 'label.com')).toEqual(['madonna@label.com']);
  });

  it('returns [] without a first name or domain', () => {
    expect(inferEmailCandidates('', 'Doe', 'x.com')).toEqual([]);
    expect(inferEmailCandidates('Jane', 'Doe', '')).toEqual([]);
  });
});

describe('verifyEmail', () => {
  it('marks a safe, non-catch-all address deliverable', async () => {
    mockReacher({ 'jane.doe@x.com': { is_reachable: 'safe', is_catch_all: false } });
    const v = await verifyEmail('jane.doe@x.com');
    expect(v.deliverable).toBe(true);
  });

  it('does NOT trust a catch-all "safe" result', async () => {
    mockReacher({ 'a@lvmh.com': { is_reachable: 'safe', is_catch_all: true } });
    const v = await verifyEmail('a@lvmh.com');
    expect(v.isCatchAll).toBe(true);
    expect(v.deliverable).toBe(false);
  });

  it('returns unknown (not deliverable) when Reacher is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const v = await verifyEmail('x@y.com');
    expect(v.reachable).toBe('unknown');
    expect(v.deliverable).toBe(false);
  });
});

describe('findVerifiedEmail', () => {
  it('returns the first deliverable candidate', async () => {
    mockReacher({
      'jane.doe@x.com': { is_reachable: 'invalid' },
      'jdoe@x.com': { is_reachable: 'safe', is_catch_all: false },
    });
    const v = await findVerifiedEmail('Jane', 'Doe', 'x.com');
    expect(v?.email).toBe('jdoe@x.com');
    expect(v?.deliverable).toBe(true);
  });

  it('returns null when nothing verifies (e.g. catch-all domain)', async () => {
    mockReacher({}); // everything defaults to invalid
    expect(await findVerifiedEmail('Jane', 'Doe', 'x.com')).toBeNull();
  });
});
