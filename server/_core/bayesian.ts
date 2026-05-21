/**
 * Bayesian reasoning primitives for AgentZ.
 *
 * Uses Beta-Binomial conjugate pairs so every conversion-rate estimate
 * starts from an informed prior and updates incrementally as outcomes
 * arrive.  Thompson sampling drives exploration; UCB1 drives task
 * prioritisation.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Parameters of a Beta distribution: α = pseudo-successes, β = pseudo-failures */
export interface BetaPrior {
  alpha: number;
  beta: number;
}

export type OutcomeSignal =
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "converted"
  | "unsubscribed"
  | "bounced";

export interface Arm<T> {
  id: T;
  prior: BetaPrior;
}

// ─── Sampling ──────────────────────────────────────────────────────────────────

/** Marsaglia-Tsang Gamma sampler (shape ≥ 1) */
function _gammaGT(shape: number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      // Box-Muller normal
      x = Math.sqrt(-2 * Math.log(Math.random())) *
          Math.cos(2 * Math.PI * Math.random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function _sampleGamma(shape: number): number {
  if (shape < 1) return _gammaGT(1 + shape) * Math.pow(Math.random(), 1 / shape);
  return _gammaGT(shape);
}

/** Draw one sample from Beta(α, β) via the gamma-ratio method */
export function sampleBeta(alpha: number, beta: number): number {
  const g1 = _sampleGamma(alpha);
  const g2 = _sampleGamma(beta);
  return g1 / (g1 + g2);
}

// ─── Moments ───────────────────────────────────────────────────────────────────

export function betaMean({ alpha, beta }: BetaPrior): number {
  return alpha / (alpha + beta);
}

export function betaVariance({ alpha, beta }: BetaPrior): number {
  const n = alpha + beta;
  return (alpha * beta) / (n * n * (n + 1));
}

/** 95 % credible interval (normal approximation) */
export function betaCI(prior: BetaPrior): [number, number] {
  const mu = betaMean(prior);
  const sd = Math.sqrt(betaVariance(prior));
  return [Math.max(0, mu - 1.96 * sd), Math.min(1, mu + 1.96 * sd)];
}

// ─── Bayesian updating ─────────────────────────────────────────────────────────

/**
 * Signal weights — how much each engagement event shifts α (positive)
 * or β (negative) in the Beta posterior.
 */
const SIGNAL_WEIGHTS: Record<OutcomeSignal, { a: number; b: number }> = {
  sent:         { a: 0,  b: 0.5 },
  opened:       { a: 1,  b: 0   },
  clicked:      { a: 2,  b: 0   },
  replied:      { a: 5,  b: 0   },
  converted:    { a: 12, b: 0   },
  unsubscribed: { a: 0,  b: 4   },
  bounced:      { a: 0,  b: 1   },
};

export function updatePrior(
  prior: BetaPrior,
  outcome: OutcomeSignal,
): BetaPrior {
  const w = SIGNAL_WEIGHTS[outcome];
  return { alpha: prior.alpha + w.a, beta: prior.beta + w.b };
}

// ─── Segment-informed priors ───────────────────────────────────────────────────
// Based on typical cold-email B2B benchmarks per vertical.

export const SEGMENT_PRIORS: Record<string, BetaPrior> = {
  GOV:     { alpha: 2,  beta: 23 }, // ~8 %  reply rate, slow-moving
  RETAIL:  { alpha: 3,  beta: 17 }, // ~15 % reply rate
  LUXURY:  { alpha: 4,  beta: 16 }, // ~20 % — high value but high barrier
  PHARMA:  { alpha: 3,  beta: 17 }, // ~15 % — regulatory driven
  MEDTECH: { alpha: 2,  beta: 18 }, // ~10 % — long sales cycle, high complexity
  TIMEPIECE: { alpha: 3,  beta: 17 }, // ~15 % — prestige driven, relationship focused
  PRESS:   { alpha: 4,  beta: 16 }, // ~20 % — journalists are responsive
  PARTNER: { alpha: 5,  beta: 15 }, // ~25 % — aligned incentive
  DEFAULT: { alpha: 2,  beta: 23 },
};

/** Revenue proxy per segment (USD, conservative pilot value) */
export const SEGMENT_REVENUE: Record<string, number> = {
  GOV:     120_000,
  RETAIL:   18_000,
  LUXURY:   45_000,
  PHARMA:   90_000,
  MEDTECH: 100_000,
  TIMEPIECE: 75_000,
  PRESS:     5_000, // brand value, not direct revenue
  PARTNER:  40_000,
  DEFAULT:  10_000,
};

// ─── Email tone arms ───────────────────────────────────────────────────────────

export type EmailTone = "formal" | "warm" | "direct" | "story";

/**
 * Segment-specific tone priors.
 * α/β encode our prior belief that a given tone converts for that segment.
 */
export const TONE_PRIORS: Record<string, Record<EmailTone, BetaPrior>> = {
  GOV: {
    formal: { alpha: 4, beta: 6  }, // government respects formality
    warm:   { alpha: 2, beta: 8  },
    direct: { alpha: 3, beta: 7  },
    story:  { alpha: 1, beta: 9  },
  },
  RETAIL: {
    formal: { alpha: 2, beta: 8  },
    warm:   { alpha: 4, beta: 6  }, // retail is relationship-driven
    direct: { alpha: 3, beta: 7  },
    story:  { alpha: 3, beta: 7  },
  },
  LUXURY: {
    formal: { alpha: 5, beta: 5  }, // luxury likes prestige
    warm:   { alpha: 2, beta: 8  },
    direct: { alpha: 1, beta: 9  },
    story:  { alpha: 5, beta: 5  }, // storytelling is key for luxury
  },
  PHARMA: {
    formal: { alpha: 6, beta: 4  }, // pharma is heavily formal/regulatory
    warm:   { alpha: 1, beta: 9  },
    direct: { alpha: 4, beta: 6  },
    story:  { alpha: 1, beta: 9  },
  },
  MEDTECH: {
    formal: { alpha: 5, beta: 5  },
    warm:   { alpha: 2, beta: 8  },
    direct: { alpha: 6, beta: 4  }, // medtech wants specs and ROI direct
    story:  { alpha: 2, beta: 8  },
  },
  PRESS: {
    formal: { alpha: 1, beta: 9  },
    warm:   { alpha: 3, beta: 7  },
    direct: { alpha: 4, beta: 6  }, // journalists like concise pitches
    story:  { alpha: 5, beta: 5  }, // story-angle works for press
  },
  PARTNER: {
    formal: { alpha: 3, beta: 7  },
    warm:   { alpha: 3, beta: 7  },
    direct: { alpha: 5, beta: 5  }, // partners want ROI fast
    story:  { alpha: 2, beta: 8  },
  },
};

const DEFAULT_TONE_PRIORS: Record<EmailTone, BetaPrior> = {
  formal: { alpha: 2, beta: 8 },
  warm:   { alpha: 3, beta: 7 },
  direct: { alpha: 3, beta: 7 },
  story:  { alpha: 2, beta: 8 },
};

// ─── Thompson sampling ─────────────────────────────────────────────────────────

/** Pick the arm with the highest sampled value from its Beta posterior */
export function thompsonSample<T>(arms: Arm<T>[]): T {
  let best = arms[0];
  let bestSample = -Infinity;
  for (const arm of arms) {
    const s = sampleBeta(arm.prior.alpha, arm.prior.beta);
    if (s > bestSample) { bestSample = s; best = arm; }
  }
  return best.id;
}

/** Select the best email tone for a segment via Thompson sampling */
export function selectTone(segment: string): EmailTone {
  const toneMap = TONE_PRIORS[segment] ?? DEFAULT_TONE_PRIORS;
  const arms: Arm<EmailTone>[] = (
    Object.entries(toneMap) as [EmailTone, BetaPrior][]
  ).map(([id, prior]) => ({ id, prior }));
  return thompsonSample(arms);
}

// ─── UCB1 task prioritisation ──────────────────────────────────────────────────

/**
 * UCB1 score for a task type.
 * Higher = run this type sooner (balances exploitation with exploration).
 * @param prior       Current Beta posterior for this task kind
 * @param totalTasks  Total tasks run so far (across all kinds)
 */
export function ucb1Score(prior: BetaPrior, totalTasks: number): number {
  const n = prior.alpha + prior.beta - 2; // actual observations
  if (n <= 0) return Infinity;            // unexplored → highest priority
  return betaMean(prior) + Math.sqrt((2 * Math.log(Math.max(1, totalTasks))) / n);
}

// ─── Expected-value mission ranking ───────────────────────────────────────────

export interface MissionCandidate {
  missionId: string;
  type: string;
  estimatedRevenue?: number;
  conversionPrior?: BetaPrior;
}

/** Sort missions by E[conversion] × estimatedRevenue, descending */
export function rankMissions(candidates: MissionCandidate[]): MissionCandidate[] {
  return [...candidates].sort((a, b) => {
    const priorA = a.conversionPrior ?? SEGMENT_PRIORS[a.type] ?? SEGMENT_PRIORS.DEFAULT;
    const priorB = b.conversionPrior ?? SEGMENT_PRIORS[b.type] ?? SEGMENT_PRIORS.DEFAULT;
    const revA = a.estimatedRevenue ?? SEGMENT_REVENUE[a.type] ?? SEGMENT_REVENUE.DEFAULT;
    const revB = b.estimatedRevenue ?? SEGMENT_REVENUE[b.type] ?? SEGMENT_REVENUE.DEFAULT;
    return betaMean(priorB) * revB - betaMean(priorA) * revA;
  });
}

// ─── Bayesian prompt builder ───────────────────────────────────────────────────

/**
 * Returns a structured reasoning preamble for LLM prompts.
 * Forces the model to articulate prior → evidence → posterior → action.
 */
export function bayesianPreamble(opts: {
  segment: string;
  tone: EmailTone;
  conversionEstimate: number;
  ci: [number, number];
  evidence?: string[];
}): string {
  const { segment, tone, conversionEstimate, ci, evidence = [] } = opts;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return `[BAYESIAN REASONING]
Prior: ${segment} segment has an estimated ${pct(conversionEstimate)} reply rate (95% CI: ${pct(ci[0])}–${pct(ci[1])}).
Selected tone: ${tone.toUpperCase()} (Thompson-sampled from posterior).
Evidence signals: ${evidence.length ? evidence.join("; ") : "none beyond segment prior"}.
Posterior belief: adjust messaging to maximise expected reply probability given the above.
Decision: write the email that best exploits this posterior while remaining authentic.
[END REASONING]

`;
}
