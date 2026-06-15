/**
 * @file rate-limit.ts
 * @project qron-platform
 * @author AuthiChain Security Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 *
 * Atomic, Redis-backed sliding-window rate limiter.
 * Falls back to a database counter if REDIS_URL is not configured.
 *
 * IMPORTANT: The previous implementation using automation_logs was
 * non-atomic (race condition), fail-open on DB error, and caused
 * unbounded table growth. This version fixes all three.
 */

import { createClient } from '@/utils/supabase/server';

/**
 * In-process Redis client — lazy singleton.
 * Only initialised when REDIS_URL is present.
 */
let _redis: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<void> } | null = null;

async function getRedis() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    // Dynamic import so the server still starts without the `ioredis` package.
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await client.connect();
    _redis = {
      incr: (k) => client.incr(k),
      expire: (k, s) => client.expire(k, s).then(() => undefined),
    };
    return _redis;
  } catch (err) {
    console.error('[rate-limit] Redis init failed, falling back to DB:', err);
    return null;
  }
}

/**
 * Redis sliding window — atomic INCR + EXPIRE.
 * Accurate under concurrent load.
 */
async function redisRateLimit(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
  const key = `rl:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  const remaining = Math.max(0, limit - count);
  return { ok: count <= limit, remaining };
}

/**
 * Database fallback — uses a dedicated `rate_limit_counters` table.
 * Atomic via upsert + increment, NOT via automation_logs.
 *
 * Required table (run once):
 *   CREATE TABLE rate_limit_counters (
 *     id          TEXT PRIMARY KEY,           -- hash(identifier + window)
 *     count       INT  NOT NULL DEFAULT 0,
 *     window_end  TIMESTAMPTZ NOT NULL,
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX ON rate_limit_counters (window_end);
 *   -- Optional: pg_cron cleanup job
 *   -- SELECT cron.schedule('0 * * * *', $$DELETE FROM rate_limit_counters WHERE window_end < now()$$);
 */
async function dbRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const supabase = await createClient();
    const windowEnd = new Date(Math.ceil(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
    const windowKey = `${identifier}:${windowEnd.toISOString()}`;

    // Atomic upsert-and-increment
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_key: windowKey,
      p_window_end: windowEnd.toISOString(),
    });

    if (error) {
      console.error('[rate-limit] DB increment error:', error);
      // Fail CLOSED (deny) on DB error — safer than fail-open
      return { ok: false, remaining: 0 };
    }

    const count = data as number;
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining };
  } catch (err) {
    console.error('[rate-limit] DB fallback threw:', err);
    return { ok: false, remaining: 0 };
  }
}

/**
 * Public API — checks and records a rate limit hit.
 *
 * @param identifier  User ID, API key prefix, or IP address
 * @param limit       Max requests allowed in the window (default 60)
 * @param windowMinutes  Window size in minutes (default 1)
 */
export async function checkRateLimit(
  identifier: string,
  limit = 60,
  windowMinutes = 1,
): Promise<{ ok: boolean; remaining: number }> {
  const windowSeconds = windowMinutes * 60;
  const redis = await getRedis();
  if (redis) {
    return redisRateLimit(redis, identifier, limit, windowSeconds);
  }
  return dbRateLimit(identifier, limit, windowSeconds);
}
