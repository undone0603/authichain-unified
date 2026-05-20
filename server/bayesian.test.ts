import { describe, expect, it } from 'vitest';
import {
  betaMean, betaVariance, betaCI,
  sampleBeta, updatePrior,
  thompsonSample, selectTone, ucb1Score,
  rankMissions, bayesianPreamble,
  SEGMENT_PRIORS, SEGMENT_REVENUE, TONE_PRIORS,
  type BetaPrior, type OutcomeSignal, type EmailTone,
} from './_core/bayesian';

// ─── betaMean ─────────────────────────────────────────────────────────────────

describe('betaMean', () => {
  it('computes α/(α+β)', () => {
    expect(betaMean({ alpha: 2, beta: 8 })).toBeCloseTo(0.2);
    expect(betaMean({ alpha: 5, beta: 5 })).toBeCloseTo(0.5);
    expect(betaMean({ alpha: 1, beta: 99 })).toBeCloseTo(0.01);
  });

  it('returns 1 for pure success prior', () => {
    expect(betaMean({ alpha: 100, beta: 0 })).toBe(1);
  });

  it('returns 0 for pure failure prior', () => {
    expect(betaMean({ alpha: 0, beta: 100 })).toBe(0);
  });
});

// ─── betaVariance ─────────────────────────────────────────────────────────────

describe('betaVariance', () => {
  it('computes αβ / ((α+β)²(α+β+1))', () => {
    const v = betaVariance({ alpha: 2, beta: 8 });
    const expected = (2 * 8) / (100 * 11);
    expect(v).toBeCloseTo(expected, 8);
  });

  it('is maximised at (1,1) uniform prior', () => {
    const uniform = betaVariance({ alpha: 1, beta: 1 });
    const informed = betaVariance({ alpha: 10, beta: 10 });
    expect(uniform).toBeGreaterThan(informed);
  });

  it('decreases as observations accumulate (same mean)', () => {
    const v1 = betaVariance({ alpha: 2, beta: 8 });   // n=10
    const v2 = betaVariance({ alpha: 20, beta: 80 }); // n=100, same mean
    expect(v1).toBeGreaterThan(v2);
  });
});

// ─── betaCI ───────────────────────────────────────────────────────────────────

describe('betaCI', () => {
  it('returns a tuple of length 2', () => {
    const ci = betaCI({ alpha: 2, beta: 8 });
    expect(ci).toHaveLength(2);
  });

  it('lower bound is less than upper bound', () => {
    const [lo, hi] = betaCI({ alpha: 3, beta: 17 });
    expect(lo).toBeLessThan(hi);
  });

  it('clamps to [0, 1]', () => {
    // alpha=100, beta=1 — mean≈0.99 so hi could exceed 1 without clamping
    const [lo, hi] = betaCI({ alpha: 100, beta: 1 });
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it('bounds straddle the mean', () => {
    const prior: BetaPrior = { alpha: 4, beta: 16 };
    const mu = betaMean(prior);
    const [lo, hi] = betaCI(prior);
    expect(lo).toBeLessThanOrEqual(mu);
    expect(hi).toBeGreaterThanOrEqual(mu);
  });

  it('wider CI for weak prior', () => {
    const [lo1, hi1] = betaCI({ alpha: 2, beta: 8 });   // weak
    const [lo2, hi2] = betaCI({ alpha: 20, beta: 80 }); // strong (same mean)
    expect(hi1 - lo1).toBeGreaterThan(hi2 - lo2);
  });
});

// ─── sampleBeta ───────────────────────────────────────────────────────────────

describe('sampleBeta', () => {
  it('always returns a value in [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const s = sampleBeta(2, 8);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('empirical mean converges to α/(α+β)', () => {
    const N = 5000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += sampleBeta(3, 7);
    const empiricalMean = sum / N;
    expect(empiricalMean).toBeCloseTo(3 / 10, 1); // ±0.05
  });

  it('samples from near-deterministic high-alpha prior are all high', () => {
    let allHigh = true;
    for (let i = 0; i < 50; i++) {
      if (sampleBeta(1000, 1) < 0.9) allHigh = false;
    }
    expect(allHigh).toBe(true);
  });

  it('samples from near-deterministic high-beta prior are all low', () => {
    let allLow = true;
    for (let i = 0; i < 50; i++) {
      if (sampleBeta(1, 1000) > 0.1) allLow = false;
    }
    expect(allLow).toBe(true);
  });
});

// ─── updatePrior ──────────────────────────────────────────────────────────────

describe('updatePrior', () => {
  const base: BetaPrior = { alpha: 2, beta: 8 };

  it('"sent" decrements β by 0.5', () => {
    const updated = updatePrior(base, 'sent');
    expect(updated.alpha).toBe(2);
    expect(updated.beta).toBe(8.5);
  });

  it('"opened" increments α by 1', () => {
    const updated = updatePrior(base, 'opened');
    expect(updated.alpha).toBe(3);
    expect(updated.beta).toBe(8);
  });

  it('"clicked" increments α by 2', () => {
    const updated = updatePrior(base, 'clicked');
    expect(updated.alpha).toBe(4);
    expect(updated.beta).toBe(8);
  });

  it('"replied" increments α by 5', () => {
    const updated = updatePrior(base, 'replied');
    expect(updated.alpha).toBe(7);
    expect(updated.beta).toBe(8);
  });

  it('"converted" increments α by 12', () => {
    const updated = updatePrior(base, 'converted');
    expect(updated.alpha).toBe(14);
    expect(updated.beta).toBe(8);
  });

  it('"unsubscribed" increments β by 4', () => {
    const updated = updatePrior(base, 'unsubscribed');
    expect(updated.alpha).toBe(2);
    expect(updated.beta).toBe(12);
  });

  it('"bounced" increments β by 1', () => {
    const updated = updatePrior(base, 'bounced');
    expect(updated.alpha).toBe(2);
    expect(updated.beta).toBe(9);
  });

  it('positive signals raise betaMean', () => {
    const positives: OutcomeSignal[] = ['opened', 'clicked', 'replied', 'converted'];
    for (const signal of positives) {
      const updated = updatePrior(base, signal);
      expect(betaMean(updated)).toBeGreaterThan(betaMean(base));
    }
  });

  it('negative signals lower betaMean', () => {
    const negatives: OutcomeSignal[] = ['unsubscribed', 'bounced'];
    for (const signal of negatives) {
      const updated = updatePrior(base, signal);
      expect(betaMean(updated)).toBeLessThan(betaMean(base));
    }
  });
});

// ─── thompsonSample ──────────────────────────────────────────────────────────

describe('thompsonSample', () => {
  it('returns the only arm if given a single arm', () => {
    const result = thompsonSample([{ id: 'only', prior: { alpha: 5, beta: 5 } }]);
    expect(result).toBe('only');
  });

  it('almost always picks the dominant arm with extreme priors', () => {
    const arms = [
      { id: 'good', prior: { alpha: 9999, beta: 1 } },
      { id: 'bad',  prior: { alpha: 1, beta: 9999 } },
    ];
    const counts: Record<string, number> = { good: 0, bad: 0 };
    for (let i = 0; i < 100; i++) counts[thompsonSample(arms)]++;
    expect(counts.good).toBeGreaterThan(95);
  });

  it('samples both arms with equal priors (no strict dominance)', () => {
    const arms = [
      { id: 'a', prior: { alpha: 2, beta: 2 } },
      { id: 'b', prior: { alpha: 2, beta: 2 } },
    ];
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 200; i++) counts[thompsonSample(arms)]++;
    expect(counts.a).toBeGreaterThan(20);
    expect(counts.b).toBeGreaterThan(20);
  });
});

// ─── selectTone ──────────────────────────────────────────────────────────────

describe('selectTone', () => {
  const validTones: EmailTone[] = ['formal', 'warm', 'direct', 'story'];

  it('returns a valid tone for GOV segment', () => {
    const tone = selectTone('GOV');
    expect(validTones).toContain(tone);
  });

  it('returns a valid tone for RETAIL segment', () => {
    expect(validTones).toContain(selectTone('RETAIL'));
  });

  it('returns a valid tone for PRESS segment', () => {
    expect(validTones).toContain(selectTone('PRESS'));
  });

  it('returns a valid tone for PARTNER segment', () => {
    expect(validTones).toContain(selectTone('PARTNER'));
  });

  it('returns a valid tone for unknown segment (falls back to default)', () => {
    expect(validTones).toContain(selectTone('UNKNOWN_SEGMENT'));
  });
});

// ─── ucb1Score ───────────────────────────────────────────────────────────────

describe('ucb1Score', () => {
  it('returns Infinity for unexplored arm (alpha+beta-2 === 0)', () => {
    const score = ucb1Score({ alpha: 1, beta: 1 }, 100);
    expect(score).toBe(Infinity);
  });

  it('returns finite score for explored arm', () => {
    const score = ucb1Score({ alpha: 5, beta: 15 }, 100);
    expect(isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });

  it('higher betaMean → higher UCB1 score (same exploration term)', () => {
    const highMean = ucb1Score({ alpha: 8, beta: 12 }, 100); // mean=0.4, n=18
    const lowMean  = ucb1Score({ alpha: 2, beta: 18 }, 100); // mean=0.1, n=18
    expect(highMean).toBeGreaterThan(lowMean);
  });

  it('unexplored arm beats any explored arm', () => {
    const unexplored = ucb1Score({ alpha: 1, beta: 1 }, 1000);
    const explored   = ucb1Score({ alpha: 500, beta: 1 }, 1000); // near-perfect mean
    expect(unexplored).toBeGreaterThan(explored);
  });

  it('exploration bonus increases with totalTasks (log growth)', () => {
    const score10   = ucb1Score({ alpha: 3, beta: 7 }, 10);
    const score1000 = ucb1Score({ alpha: 3, beta: 7 }, 1000);
    expect(score1000).toBeGreaterThan(score10);
  });
});

// ─── rankMissions ────────────────────────────────────────────────────────────

describe('rankMissions', () => {
  it('sorts by E[conversion] × revenue descending', () => {
    const candidates = [
      { missionId: 'low',  type: 'GOV',     conversionPrior: { alpha: 1, beta: 99 }, estimatedRevenue: 100_000 },
      { missionId: 'high', type: 'PARTNER', conversionPrior: { alpha: 50, beta: 50 }, estimatedRevenue: 40_000 },
      { missionId: 'mid',  type: 'RETAIL',  conversionPrior: { alpha: 10, beta: 10 }, estimatedRevenue: 18_000 },
    ];
    const ranked = rankMissions(candidates);
    // high: 0.5 × 40k = 20k
    // mid:  0.5 × 18k = 9k
    // low:  ~0.01 × 100k = 1k
    expect(ranked[0].missionId).toBe('high');
    expect(ranked[1].missionId).toBe('mid');
    expect(ranked[2].missionId).toBe('low');
  });

  it('returns empty array for empty input', () => {
    expect(rankMissions([])).toEqual([]);
  });

  it('uses SEGMENT_PRIORS as fallback when no conversionPrior provided', () => {
    const candidates = [
      { missionId: 'gov',     type: 'GOV' },
      { missionId: 'partner', type: 'PARTNER' },
    ];
    const ranked = rankMissions(candidates);
    // PARTNER has higher mean (~0.25) × rev (40k) vs GOV (~0.08) × rev (120k)
    // PARTNER: 0.25 × 40k = 10k
    // GOV:     0.08 × 120k = 9.6k
    // PARTNER should come first
    expect(ranked[0].missionId).toBe('partner');
  });

  it('does not mutate the input array', () => {
    const candidates = [
      { missionId: 'a', type: 'GOV' },
      { missionId: 'b', type: 'PARTNER' },
    ];
    const original = [...candidates];
    rankMissions(candidates);
    expect(candidates[0].missionId).toBe(original[0].missionId);
  });
});

// ─── bayesianPreamble ────────────────────────────────────────────────────────

describe('bayesianPreamble', () => {
  const preamble = bayesianPreamble({
    segment: 'GOV',
    tone: 'formal',
    conversionEstimate: 0.08,
    ci: [0.02, 0.14],
    evidence: ['lead title: Director of Procurement'],
  });

  it('contains the [BAYESIAN REASONING] header', () => {
    expect(preamble).toContain('[BAYESIAN REASONING]');
  });

  it('contains the [END REASONING] footer', () => {
    expect(preamble).toContain('[END REASONING]');
  });

  it('mentions the segment', () => {
    expect(preamble).toContain('GOV');
  });

  it('mentions the tone in uppercase', () => {
    expect(preamble).toContain('FORMAL');
  });

  it('includes conversion estimate as percentage', () => {
    expect(preamble).toContain('8.0%');
  });

  it('includes CI bounds', () => {
    expect(preamble).toContain('2.0%');
    expect(preamble).toContain('14.0%');
  });

  it('includes provided evidence', () => {
    expect(preamble).toContain('Director of Procurement');
  });

  it('reports "none beyond segment prior" when no evidence', () => {
    const p = bayesianPreamble({
      segment: 'RETAIL',
      tone: 'warm',
      conversionEstimate: 0.15,
      ci: [0.05, 0.25],
    });
    expect(p).toContain('none beyond segment prior');
  });
});

// ─── SEGMENT_PRIORS / SEGMENT_REVENUE / TONE_PRIORS ──────────────────────────

describe('SEGMENT_PRIORS', () => {
  it('has entries for GOV, RETAIL, PRESS, PARTNER, DEFAULT', () => {
    for (const seg of ['GOV', 'RETAIL', 'PRESS', 'PARTNER', 'DEFAULT']) {
      expect(SEGMENT_PRIORS).toHaveProperty(seg);
    }
  });

  it('each entry has alpha and beta > 0', () => {
    for (const [, prior] of Object.entries(SEGMENT_PRIORS)) {
      expect(prior.alpha).toBeGreaterThan(0);
      expect(prior.beta).toBeGreaterThan(0);
    }
  });

  it('GOV conversion mean is lower than PARTNER', () => {
    expect(betaMean(SEGMENT_PRIORS.GOV)).toBeLessThan(betaMean(SEGMENT_PRIORS.PARTNER));
  });
});

describe('SEGMENT_REVENUE', () => {
  it('has entries for all segments', () => {
    for (const seg of ['GOV', 'RETAIL', 'PRESS', 'PARTNER', 'DEFAULT']) {
      expect(SEGMENT_REVENUE).toHaveProperty(seg);
    }
  });

  it('GOV has the highest revenue proxy', () => {
    const values = Object.values(SEGMENT_REVENUE);
    expect(SEGMENT_REVENUE.GOV).toBe(Math.max(...values));
  });
});

describe('TONE_PRIORS', () => {
  const tones: EmailTone[] = ['formal', 'warm', 'direct', 'story'];

  it('has all four segments', () => {
    for (const seg of ['GOV', 'RETAIL', 'PRESS', 'PARTNER']) {
      expect(TONE_PRIORS).toHaveProperty(seg);
    }
  });

  it('each segment has all four tones', () => {
    for (const seg of ['GOV', 'RETAIL', 'PRESS', 'PARTNER']) {
      for (const tone of tones) {
        expect(TONE_PRIORS[seg]).toHaveProperty(tone);
        expect(TONE_PRIORS[seg][tone].alpha).toBeGreaterThan(0);
        expect(TONE_PRIORS[seg][tone].beta).toBeGreaterThan(0);
      }
    }
  });

  it('GOV favours formal over story', () => {
    expect(betaMean(TONE_PRIORS.GOV.formal)).toBeGreaterThan(betaMean(TONE_PRIORS.GOV.story));
  });

  it('PRESS favours story over formal', () => {
    expect(betaMean(TONE_PRIORS.PRESS.story)).toBeGreaterThan(betaMean(TONE_PRIORS.PRESS.formal));
  });

  it('PARTNER favours direct', () => {
    const direct = betaMean(TONE_PRIORS.PARTNER.direct);
    for (const tone of tones) {
      expect(direct).toBeGreaterThanOrEqual(betaMean(TONE_PRIORS.PARTNER[tone]));
    }
  });
});
