import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same seam as server/ops-summary.test.ts: intercept the drizzle() factory so
// @/db's internals are observable without a real Postgres connection.
const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

const onConflictDoNothing = vi.fn(async () => undefined);
const onConflictDoUpdate = vi.fn(async () => undefined);
const insertValues = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
const insert = vi.fn(() => ({ values: insertValues }));

const execute = vi.fn();

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ select, insert, execute }) }));
vi.mock('postgres', () => ({ default: () => ({}) }));

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

import { checkAndReserve, recordEvent, addSuppression, toggleKillSwitch } from './guardrail';

const CHANNEL_ROW = { id: 1, name: 'content.publish', category: 'content', dailyCap: 10, enabled: true, spendCeilingCents: 0, description: null };

beforeEach(() => {
  vi.clearAllMocks();
  insertValues.mockImplementation(() => ({ onConflictDoNothing, onConflictDoUpdate }));
});

describe('checkAndReserve', () => {
  it('allows a send within the daily cap and reserves it atomically', async () => {
    limit
      .mockResolvedValueOnce([]) // global kill switch: none
      .mockResolvedValueOnce([CHANNEL_ROW]) // channel lookup
      .mockResolvedValueOnce([]); // channel kill switch: none
    execute
      .mockResolvedValueOnce(undefined) // ensure-row insert
      .mockResolvedValueOnce([{ count: 3 }]); // guarded update+returning

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: true, remaining: 7 });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('denies when the global kill switch is engaged', async () => {
    limit.mockResolvedValueOnce([{ scope: 'global', enabled: true }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/global kill switch/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('denies an unknown channel', async () => {
    limit
      .mockResolvedValueOnce([]) // no global kill
      .mockResolvedValueOnce([]); // channel lookup: not found

    const result = await checkAndReserve('nonexistent.channel', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'unknown channel: nonexistent.channel' });
  });

  it('denies a disabled channel', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...CHANNEL_ROW, enabled: false }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'channel disabled' });
  });

  it('denies when the channel kill switch is engaged', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([{ scope: 'content.publish', enabled: true, reason: 'bounce spike' }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'channel kill switch engaged: bounce spike' });
  });

  it('denies a suppressed recipient', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'bad@example.com', reason: 'bounced' }]);

    const result = await checkAndReserve('content.publish', 1, 'bad@example.com');

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'recipient suppressed: bounced' });
  });

  it('denies when the daily cap is already reached', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([]);
    execute
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]); // guarded UPDATE matched no row -> cap reached

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'daily cap reached' });
  });

  it('denies a count of zero', async () => {
    limit.mockResolvedValueOnce([]); // no global kill switch

    const result = await checkAndReserve('content.publish', 0);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'invalid count' });
    expect(select).toHaveBeenCalledTimes(1); // only the global kill switch check
  });

  it('denies a negative count', async () => {
    limit.mockResolvedValueOnce([]); // no global kill switch

    const result = await checkAndReserve('content.publish', -100);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'invalid count' });
    expect(select).toHaveBeenCalledTimes(1); // only the global kill switch check
  });

  it('denies a non-integer count', async () => {
    limit.mockResolvedValueOnce([]); // no global kill switch

    const result = await checkAndReserve('content.publish', 1.5);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'invalid count' });
    expect(select).toHaveBeenCalledTimes(1); // only the global kill switch check
  });
});

describe('recordEvent', () => {
  it('logs an event tied to the resolved channel id', async () => {
    limit.mockResolvedValueOnce([CHANNEL_ROW]);

    await recordEvent({ channel: 'content.publish', action: 'check', allowed: true, reason: 'ok' });

    expect(insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 1, action: 'check', allowed: true, reason: 'ok' }),
    );
  });
});

describe('addSuppression', () => {
  it('lowercases the email and upserts idempotently', async () => {
    await addSuppression('Bad@Example.com', 'bounced', 'resend-webhook');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bad@example.com', reason: 'bounced', source: 'resend-webhook' }),
    );
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});

describe('toggleKillSwitch', () => {
  it('upserts the kill switch row for the given scope', async () => {
    await toggleKillSwitch('email.qron-drip', true, 'bounce rate 15%', 'system');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'email.qron-drip', enabled: true, reason: 'bounce rate 15%', updatedBy: 'system' }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });
});
