/**
 * empty-redis stub
 *
 * This stub replaces `redis` and `ioredis` in environments where Redis is not
 * available (Cloudflare Workers, Vercel Edge, local dev without Redis).
 *
 * Any code that calls Redis methods at runtime will receive a clear error
 * instead of a silent undefined, making misconfiguration easy to diagnose.
 *
 * To use real Redis, set REDIS_URL in your environment and remove the pnpm
 * overrides in package.json that point to this stub.
 */

const STUB_MESSAGE =
  "Redis is not configured in this environment. " +
  "Set REDIS_URL and remove the empty-redis stub overrides in package.json " +
  "to enable caching features.";

const handler = {
  get(_target, prop) {
    // Allow standard inspection paths to avoid breaking require/import mechanics
    if (["then", "default", "__esModule", Symbol.toPrimitive, Symbol.toStringTag].includes(prop)) {
      return undefined;
    }
    return () => {
      throw new Error(`[empty-redis] Cannot call .${String(prop)}() — ${STUB_MESSAGE}`);
    };
  },
  construct() {
    throw new Error(`[empty-redis] Cannot instantiate Redis client — ${STUB_MESSAGE}`);
  },
};

const stub = new Proxy(function RedisStub() {}, handler);

module.exports = stub;
module.exports.default = stub;
module.exports.Redis = stub;
module.exports.createClient = () => stub;
