// Durable Object–backed rate limiter.
//
// Replaces the Express in-memory Map rate limiter (server/_core/rate-limit.ts)
// on the Workers path with durable, distributed storage — same count/resetAt
// sliding-window algorithm, one Durable Object instance per rate-limit key
// (e.g. "oauth:1.2.3.4") instead of a process-local Map entry.
//
// Communication with the DO instance goes through the classic fetch() stub
// method rather than Durable Object RPC (calling stub.check(...) directly).
// RPC-style calls require the class to `extends DurableObject` from
// "cloudflare:workers" (confirmed against real workerd via `wrangler dev`:
// without that base class you get "TypeError: The receiving Durable Object
// does not support RPC, because its class was not declared with `extends
// DurableObject`"). That import only resolves inside the workerd runtime,
// but worker-app/index.ts (which re-exports RateLimiter) is also imported
// directly by worker-app/routes.test.ts under the plain Node vitest
// environment (see vitest.config.ts's "worker-app/**/*.test.ts" include) —
// importing "cloudflare:workers" there throws ERR_UNSUPPORTED_ESM_URL_SCHEME
// and breaks that test file's `await import("./index")` at module-load
// time. The fetch() stub method is the original, always-supported way to
// talk to a Durable Object and needs no special base class, so it keeps
// this file Node-import-safe while still working correctly under workerd.

export class RateLimiter {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const { limit, windowMs, peek } = await request.json<{
      limit: number;
      windowMs: number;
      peek?: boolean;
    }>();
    const allowed = peek
      ? await this.peek(limit)
      : await this.check(limit, windowMs);
    return new Response(JSON.stringify({ allowed }), {
      headers: { "content-type": "application/json" },
    });
  }

  /** Non-consuming: would one more request be allowed right now? */
  private async peek(limit: number): Promise<boolean> {
    const stored = await this.state.storage.get<{
      count: number;
      resetAt: number;
    }>("entry");
    if (!stored || Date.now() >= stored.resetAt) return limit > 0;
    return stored.count < limit;
  }

  /**
   * Returns true if the request is allowed under `limit` requests per
   * `windowMs`, false if the caller should be rate limited. Mirrors the
   * fixed-window logic in server/_core/rate-limit.ts's in-memory
   * RateLimiter.check() (that file separately evicts expired Map entries
   * when store.size > 10_000 — not needed here since each DO instance holds
   * exactly one key's entry in its own storage).
   */
  private async check(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const stored = await this.state.storage.get<{
      count: number;
      resetAt: number;
    }>("entry");

    if (!stored || now >= stored.resetAt) {
      await this.state.storage.put("entry", {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (stored.count >= limit) {
      return false;
    }

    await this.state.storage.put("entry", {
      count: stored.count + 1,
      resetAt: stored.resetAt,
    });
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
  const stub = namespace.get(id);
  const res = await stub.fetch("https://rate-limiter/check", {
    method: "POST",
    body: JSON.stringify({ limit, windowMs }),
  });
  const { allowed } = await res.json<{ allowed: boolean }>();
  return allowed;
}

/** Like checkRateLimit but never increments the counter. */
export async function peekRateLimit(
  namespace: DurableObjectNamespace,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const stub = namespace.get(namespace.idFromName(key));
  const res = await stub.fetch("https://rate-limiter/check", {
    method: "POST",
    body: JSON.stringify({ limit, windowMs, peek: true }),
  });
  const { allowed } = await res.json<{ allowed: boolean }>();
  return allowed;
}
