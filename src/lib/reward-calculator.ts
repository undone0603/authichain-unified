/**
 * QRON scan-reward calculation engine.
 *
 * Formula: finalReward = min(baseReward * categoryMultiplier + accuracyBonus +
 * geoBonus + firstFlagBonus, dailyCap - dailyTotal) * (1 - velocityPenalty)
 */

export const CATEGORY_MULTIPLIERS: Record<string, number> = {
  luxury_fashion: 2.5,
  pharma: 2.0,
  electronics: 1.5,
  automotive: 1.8,
  food_bev: 1.2,
  cosmetics: 1.5,
  cannabis: 1.5,
  art_collectibles: 2.0,
  sports: 1.5,
  fashion_apparel: 1.8,
  other: 1.0,
};

export const BASE_REWARD = 0.1; // QRON per scan
export const DAILY_CAP = 10.0; // Max QRON per user per day
export const ACCURACY_BONUS = 0.05; // Bonus for consensus-aligned scans
export const GEO_HOTSPOT_BONUS = 0.03; // Bonus for scanning in known counterfeit hotspots
export const FIRST_FLAG_BONUS = 0.15; // Bonus for being first to flag a counterfeit
export const VELOCITY_THRESHOLD = 5; // Max scans in a 60s window before penalty kicks in
export const VELOCITY_PENALTY_RATE = 0.15; // 15% penalty per excess scan

export interface RewardCalculationInput {
  scanType: 'authentic' | 'suspicious' | 'fake';
  productCategory: string;
  isConsensusAligned: boolean | null; // null = pending consensus
  isFirstFlag: boolean;
  isGeoHotspot: boolean;
  recentScanCount: number; // scans in the last 60s window
  dailyTotalSoFar: number; // QRON already earned today
}

export interface RewardCalculationResult {
  baseReward: number;
  categoryMultiplier: number;
  accuracyBonus: number;
  geoBonus: number;
  firstFlagBonus: number;
  velocityPenalty: number;
  finalReward: number;
  dailyTotal: number;
  dailyCapped: boolean;
  breakdown: string;
}

export function calculateReward(input: RewardCalculationInput): RewardCalculationResult {
  const {
    scanType,
    productCategory,
    isConsensusAligned,
    isFirstFlag,
    isGeoHotspot,
    recentScanCount,
    dailyTotalSoFar,
  } = input;

  const base = BASE_REWARD;
  const catMult = CATEGORY_MULTIPLIERS[productCategory] ?? CATEGORY_MULTIPLIERS.other;
  const accBonus = isConsensusAligned === true ? ACCURACY_BONUS : 0;
  const geoBonus = isGeoHotspot ? GEO_HOTSPOT_BONUS : 0;
  const flagBonus =
    isFirstFlag && (scanType === 'suspicious' || scanType === 'fake') ? FIRST_FLAG_BONUS : 0;

  const excessScans = Math.max(0, recentScanCount - VELOCITY_THRESHOLD);
  const velPenalty = Math.min(excessScans * VELOCITY_PENALTY_RATE, 0.9); // capped at 90%

  const rawReward = (base * catMult + accBonus + geoBonus + flagBonus) * (1 - velPenalty);

  const remainingCap = Math.max(0, DAILY_CAP - dailyTotalSoFar);
  const finalReward = Math.min(rawReward, remainingCap);
  const dailyCapped = rawReward > remainingCap;
  const dailyTotal = dailyTotalSoFar + finalReward;

  const parts: string[] = [];
  parts.push(`Base: ${base.toFixed(4)} QRON`);
  parts.push(`Category (${productCategory}): x${catMult}`);
  if (accBonus > 0) parts.push(`Accuracy bonus: +${accBonus.toFixed(4)}`);
  if (geoBonus > 0) parts.push(`Geo hotspot: +${geoBonus.toFixed(4)}`);
  if (flagBonus > 0) parts.push(`First flag: +${flagBonus.toFixed(4)}`);
  if (velPenalty > 0) parts.push(`Velocity penalty: -${(velPenalty * 100).toFixed(1)}%`);
  if (dailyCapped) parts.push(`Daily cap applied (${DAILY_CAP} QRON)`);

  return {
    baseReward: base,
    categoryMultiplier: catMult,
    accuracyBonus: accBonus,
    geoBonus,
    firstFlagBonus: flagBonus,
    velocityPenalty: velPenalty,
    finalReward: Number(finalReward.toFixed(8)),
    dailyTotal: Number(dailyTotal.toFixed(8)),
    dailyCapped,
    breakdown: parts.join(' | '),
  };
}

/** Estimate reward for a hypothetical scan (used by the public calculator UI). */
export function estimateReward(
  productCategory: string,
  scanType: 'authentic' | 'suspicious' | 'fake' = 'authentic',
  dailyTotalSoFar = 0,
): RewardCalculationResult {
  return calculateReward({
    scanType,
    productCategory,
    isConsensusAligned: true, // assume best case for estimation
    isFirstFlag: scanType !== 'authentic',
    isGeoHotspot: false,
    recentScanCount: 0,
    dailyTotalSoFar,
  });
}
