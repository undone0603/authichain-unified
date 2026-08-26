import { describe, it, expect, vi, afterEach } from 'vitest';

const logActivity = vi.fn(async (..._a: unknown[]) => {});
const notifyOwner = vi.fn(async (..._a: unknown[]) => {});
const { rev } = vi.hoisted(() => ({ rev: { rows: [] as Array<{ amount: string }> } }));
vi.mock('../db', () => ({
  logActivity: (...a: unknown[]) => logActivity(...a),
  getRevenueAnalytics: async () => rev.rows,
}));
vi.mock('../_core/notification', () => ({ notifyOwner: (...a: unknown[]) => notifyOwner(...a) }));

import {
  computePayout, defaultSplit, runFounderPayout,
  lastMonthRange, collectedRevenueCents, runMonthlyFounderPayout,
} from './founder-payout';

afterEach(() => {
  delete process.env.FOUNDER_PAY_PCT;
  delete process.env.TAX_RESERVE_PCT;
  delete process.env.PROFIT_RESERVE_PCT;
  logActivity.mockClear();
  notifyOwner.mockClear();
});

describe('computePayout', () => {
  it('splits pay-yourself-first with no lost cents', () => {
    const p = computePayout(100000, { founderPct: 30, taxReservePct: 25, profitReservePct: 5 });
    expect(p.founderCents).toBe(30000);
    expect(p.taxReserveCents).toBe(25000);
    expect(p.profitReserveCents).toBe(5000);
    expect(p.operatingCents).toBe(40000);
    expect(p.founderCents + p.taxReserveCents + p.profitReserveCents + p.operatingCents).toBe(100000);
  });

  it('keeps operating as the exact remainder so rounding never loses cents', () => {
    const p = computePayout(99, { founderPct: 33, taxReservePct: 33, profitReservePct: 33 });
    expect(p.founderCents + p.taxReserveCents + p.profitReserveCents + p.operatingCents).toBe(99);
  });

  it('rejects splits over 100% and negative gross', () => {
    expect(() => computePayout(1000, { founderPct: 60, taxReservePct: 30, profitReservePct: 20 })).toThrow();
    expect(() => computePayout(-1)).toThrow();
  });
});

describe('defaultSplit', () => {
  it('defaults to 30/25/5 and honors env overrides', () => {
    expect(defaultSplit()).toEqual({ founderPct: 30, taxReservePct: 25, profitReservePct: 5 });
    process.env.FOUNDER_PAY_PCT = '40';
    expect(defaultSplit().founderPct).toBe(40);
  });
});

describe('runFounderPayout', () => {
  it('computes, logs, and notifies the owner', async () => {
    const p = await runFounderPayout(100000);
    expect(p.founderCents).toBe(30000);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'founder_payout_computed' }));
    expect(notifyOwner).toHaveBeenCalled();
  });
});

describe('lastMonthRange', () => {
  it('covers the full previous calendar month in UTC', () => {
    const { start, end } = lastMonthRange(new Date('2026-03-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });
  it('handles the January -> December year rollover', () => {
    const { start, end } = lastMonthRange(new Date('2026-01-10T00:00:00Z'));
    expect(start.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(end.getUTCFullYear()).toBe(2025);
  });
});

describe('collectedRevenueCents', () => {
  it('sums revenueRecords.amount (dollars) into cents', async () => {
    rev.rows = [{ amount: '199.00' }, { amount: '499.50' }, { amount: 'bad' } as any];
    const cents = await collectedRevenueCents(new Date(), new Date());
    expect(cents).toBe(69850); // 199.00 + 499.50 = 698.50 -> 69850 cents; 'bad' ignored
  });
});

describe('runMonthlyFounderPayout', () => {
  it('reads last month revenue and applies the split', async () => {
    rev.rows = [{ amount: '1000.00' }];
    const p = await runMonthlyFounderPayout(new Date('2026-03-02T00:00:00Z'));
    expect(p.grossCents).toBe(100000);
    expect(p.founderCents).toBe(30000);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'founder_payout_computed' }));
  });
});
