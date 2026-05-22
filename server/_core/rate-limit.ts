import type { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";

type Entry = { count: number; resetAt: number };

class RateLimiter {
  private store = new Map<string, Entry>();

  check(key: string, max: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
    const now = Date.now();

    // Evict expired entries when the store grows large
    if (this.store.size > 10_000) {
      for (const [k, v] of this.store) {
        if (now >= v.resetAt) this.store.delete(k);
      }
    }

    let entry = this.store.get(key);
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterMs: 0 };
    }

    if (entry.count >= max) {
      return { ok: false, retryAfterMs: entry.resetAt - now };
    }

    entry.count++;
    return { ok: true, retryAfterMs: 0 };
  }
}

function getClientIp(req: Request): string {
  // Trust proxy headers set by Vercel / Railway; req.ip respects app.set("trust proxy")
  return req.ip ?? (req.socket?.remoteAddress ?? "unknown");
}

// Shared limiter instances (one per logical boundary)
const authLimiter = new RateLimiter();
const contactLimiter = new RateLimiter();
const gptLimiter = new RateLimiter();
const trpcPublicLimiter = new RateLimiter();
const globalLimiter = new RateLimiter();

/** Express middleware factory */
function expressLimit(limiter: RateLimiter, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { ok, retryAfterMs } = limiter.check(getClientIp(req), max, windowMs);
    if (!ok) {
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    next();
  };
}

// ─── Express limiters (attach in app.ts) ────────────────────────────────────

/** OAuth callback: 20 attempts per 15 min per IP */
export const oauthRateLimit = expressLimit(authLimiter, 20, 15 * 60_000);

/** Contact form: 5 submissions per hour per IP */
export const contactRateLimit = expressLimit(contactLimiter, 5, 60 * 60_000);

/** GPT plugin endpoints: 60 requests per minute per IP */
export const gptRateLimit = expressLimit(gptLimiter, 60, 60_000);

/** Catch-all API guard: 300 requests per minute per IP */
export const globalApiRateLimit = expressLimit(globalLimiter, 300, 60_000);

// ─── tRPC middleware (attach to publicProcedure mutations in trpc.ts) ────────

/** 30 public tRPC mutations per minute per IP */
export function checkTrpcPublicLimit(req: Request): void {
  const { ok, retryAfterMs } = trpcPublicLimiter.check(getClientIp(req), 30, 60_000);
  if (!ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
    });
  }
}
