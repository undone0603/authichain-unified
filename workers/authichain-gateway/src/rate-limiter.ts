import type { Env } from "./index";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Sliding window rate limiter using KV.
 * Tracks per-minute (rpm) and per-day (rpd) limits.
 */
export async function checkRateLimit(
  env: Env,
  tenantId: number,
  limits: { rpm: number; rpd: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000);
  const dayWindow = new Date().toISOString().slice(0, 10);

  const minuteKey = `rl:${tenantId}:m:${minuteWindow}`;
  const dayKey = `rl:${tenantId}:d:${dayWindow}`;

  // Read current counts
  const [minuteCount, dayCount] = await Promise.all([
    env.RATE_LIMITS.get(minuteKey).then((v) => parseInt(v || "0", 10)),
    env.RATE_LIMITS.get(dayKey).then((v) => parseInt(v || "0", 10)),
  ]);

  // Check per-minute limit
  if (minuteCount >= limits.rpm) {
    const resetAt = (minuteWindow + 1) * 60000;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000),
    };
  }

  // Check per-day limit
  if (dayCount >= limits.rpd) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    const resetAt = tomorrow.getTime();
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000),
    };
  }

  // Increment counters
  await Promise.all([
    env.RATE_LIMITS.put(minuteKey, String(minuteCount + 1), { expirationTtl: 120 }),
    env.RATE_LIMITS.put(dayKey, String(dayCount + 1), { expirationTtl: 90000 }),
  ]);

  const remaining = Math.min(limits.rpm - minuteCount - 1, limits.rpd - dayCount - 1);
  const resetAt = (minuteWindow + 1) * 60000;

  return { allowed: true, remaining, resetAt };
}
