// Durable Object–backed rate limiter.
//
// Replaces the Express in-memory Map rate limiter (server/_core/rate-limit.ts)
// on the Workers path with durable, distributed storage — same count/resetAt
// sliding-window algorithm, one Durable Object instance per rate-limit key
// (e.g. "oauth:1.2.3.4") instead of a process-local Map entry.
//
// NOTE: this intentionally does NOT import the DurableObject base class
// helper from "cloudflare:workers". worker-app/index.ts re-exports the
// RateLimiter class below, and worker-app/index.ts is imported directly by
// worker-app/routes.test.ts under the plain Node vitest environment (see
// vitest.config.ts's "worker-app/**/*.test.ts" include) — "cloudflare:workers"
// only resolves inside the workerd runtime and would throw
// ERR_UNSUPPORTED_ESM_URL_SCHEME under Node, breaking that test file's
// await import("./index") at module-load time. A Durable Object class only
// needs a (state, env) constructor to work with the Workers runtime — the
// "cloudflare:workers" base class is convenience sugar, not a requirement —
// so a plain class avoids the Node-incompatible import entirely.

export class RateLimiter {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  /**
   * Returns true if the request is allowed under `limit` requests per
   * `windowMs`, false if the caller should be rate limited. Mirrors the
   * fixed-window logic in server/_core/rate-limit.ts's in-memory
   * RateLimiter.check() (that file separately evicts expired Map entries
   * when store.size > 10_000 — not needed here since each DO instance holds
   * exactly one key's entry in its own storage).
   */
  async check(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const stored = await this.state.storage.get<{ count: number; resetAt: number }>("entry");

    if (!stored || now >= stored.resetAt) {
      await this.state.storage.put("entry", { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (stored.count >= limit) {
      return false;
    }

    await this.state.storage.put("entry", { count: stored.count + 1, resetAt: stored.resetAt });
    return true;
  }
}

/**
 * Looks up (or creates) the Durable Object instance for `key` and checks it
 * against `limit` requests per `windowMs`. `key` should already be scoped to
 * the specific limiter (e.g. "oauth:<ip>", "global:<ip>") so unrelated
 * limiters never collide on the same DO instance.
 */
export async function checkRateLimit(
  namespace: DurableObjectNamespace,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const id = namespace.idFromName(key);
  const stub = namespace.get(id) as unknown as { check(limit: number, windowMs: number): Promise<boolean> };
  return stub.check(limit, windowMs);
}
