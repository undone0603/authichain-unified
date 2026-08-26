import { describe, it, expect, vi, beforeEach } from 'vitest';

const where = vi.fn();
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ select }) }));
vi.mock('postgres', () => ({ default: () => ({}) }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const { toggleKillSwitch, recordEvent } = vi.hoisted(() => ({
  toggleKillSwitch: vi.fn(async () => undefined),
  recordEvent: vi.fn(async () => undefined),
}));
vi.mock('./guardrail', () => ({ toggleKillSwitch, recordEvent }));

import { evaluateAnomalies } from './guardrail-anomaly';

const CHANNEL = { id: 1, name: 'email.qron-drip', category: 'email', dailyCap: 30, enabled: true, spendCeilingCents: 0, description: null };
const NOW = new Date('2026-07-29T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('evaluateAnomalies', () => {
  it('trips a channel whose 24h bounce rate exceeds 10%', async () => {
    const sendEvents = Array.from({ length: 20 }, (_, i) => ({
      id: i, channelId: 1, action: 'record', allowed: true, reason: null,
      metadata: { bounced: i < 4 }, // 4/20 = 20% bounce
      createdAt: NOW,
    }));
    where
      .mockResolvedValueOnce([CHANNEL]) // enabled channels
      .mockResolvedValueOnce(sendEvents); // events for this channel

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([{ channel: 'email.qron-drip', reason: expect.stringMatching(/bounce rate 20\.0%/) }]);
    expect(toggleKillSwitch).toHaveBeenCalledWith('email.qron-drip', true, expect.stringMatching(/bounce rate/), 'system');
  });

  it('trips a channel whose volume is 3x its trailing 7-day average', async () => {
    where
      .mockResolvedValueOnce([CHANNEL]) // enabled channels
      .mockResolvedValueOnce([]) // no send events
      .mockResolvedValueOnce([
        { id: 1, channelId: 1, day: '2026-07-22', count: 5 },
        { id: 2, channelId: 1, day: '2026-07-28', count: 5 },
        { id: 3, channelId: 1, day: '2026-07-29', count: 30 }, // today, 6x the ~5 avg
      ]);

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([{ channel: 'email.qron-drip', reason: expect.stringMatching(/volume spike/) }]);
  });

  it('does not trip a healthy channel', async () => {
    where
      .mockResolvedValueOnce([CHANNEL])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, channelId: 1, day: '2026-07-28', count: 10 },
        { id: 2, channelId: 1, day: '2026-07-29', count: 11 },
      ]);

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([]);
    expect(toggleKillSwitch).not.toHaveBeenCalled();
  });
});
