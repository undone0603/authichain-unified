import { describe, it, expect } from 'vitest';
import {
  generateAffiliateCode, generateReferralCode, commissionForPlan,
  COMMISSION_RATES, AFFILIATE_BONUS_TIERS,
} from './core';

describe('affiliate / referral codes (attribution keys)', () => {
  it('generates user-scoped AFF and REF codes', () => {
    expect(generateAffiliateCode(42)).toMatch(/^AFF-42-[A-Z0-9_-]{6}$/);
    expect(generateReferralCode(42)).toMatch(/^REF-42-[A-Z0-9_-]{6}$/);
  });

  it('is unique per call (no collisions in the link)', () => {
    const a = new Set([generateAffiliateCode(1), generateAffiliateCode(1), generateAffiliateCode(1)]);
    expect(a.size).toBe(3);
  });
});

describe('commissionForPlan (recurring)', () => {
  it('applies the per-plan rate', () => {
    expect(commissionForPlan('professional', 19900)).toBe(Math.round(19900 * 0.15)); // $29.85
    expect(commissionForPlan('agency', 100000)).toBe(25000); // 25%
    expect(commissionForPlan('starter', 4900)).toBe(490);    // 10%
  });

  it('falls back to the starter rate for unknown plans', () => {
    expect(commissionForPlan('mystery', 10000)).toBe(1000);
  });

  it('guards invalid input', () => {
    expect(commissionForPlan('agency', -5)).toBe(0);
    expect(commissionForPlan('agency', NaN)).toBe(0);
  });
});

describe('bonus tiers', () => {
  it('escalate by referral threshold', () => {
    expect(AFFILIATE_BONUS_TIERS.map(t => t.threshold)).toEqual([5, 10, 25]);
    expect(AFFILIATE_BONUS_TIERS.map(t => t.tier)).toEqual(['silver', 'gold', 'platinum']);
  });

  it('rates increase with plan value', () => {
    expect(COMMISSION_RATES.starter).toBeLessThan(COMMISSION_RATES.agency);
  });
});
