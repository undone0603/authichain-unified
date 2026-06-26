import { describe, it, expect, vi, afterEach } from 'vitest';

const logActivity = vi.fn(async (..._a: unknown[]) => {});
const notifyOwner = vi.fn(async (..._a: unknown[]) => {});
vi.mock('../db', () => ({ logActivity: (...a: unknown[]) => logActivity(...a) }));
vi.mock('../_core/notification', () => ({ notifyOwner: (...a: unknown[]) => notifyOwner(...a) }));

import { computePayout, defaultSplit, runFounderPayout } from './founder-payout';

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
