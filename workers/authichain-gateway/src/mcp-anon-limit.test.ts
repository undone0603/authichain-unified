// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * /mcp is anonymous but carries INTERNAL_SECRET to the backend, and
 * generate_qr_art starts paid image generation. It used to bypass the rate
 * limiter entirely (only tenant routes were limited).
 */

const handleMcp = vi.fn(async () => new Response("{}", { status: 200 }));
vi.mock("./mcp-server", () => ({ handleMcp }));

const worker = (await import("./index")).default;
const { MCP_ANON_LIMITS } = await import("./index");

function memoryKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    keys: () => [...store.keys()],
  };
}

function env(kv = memoryKv()) {
  return {
    RATE_LIMITS: kv,
    TENANT_CACHE: memoryKv(),
    USAGE_BUFFER: memoryKv(),
    BACKEND_URL: "https://backend.invalid",
    INTERNAL_SECRET: "s",
    WORKER_VERSION: "test",
  } as never;
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as never;
const call = (e: unknown, ip: string) =>
  worker.fetch(
    new Request("https://gateway.test/mcp", { method: "POST", headers: { "cf-connecting-ip": ip } }),
    e as never,
    ctx,
  );

describe("anonymous /mcp budget", () => {
  it("allows up to the per-minute budget per address, then answers 429 without reaching MCP", async () => {
    handleMcp.mockClear();
    const kv = memoryKv();
    const e = env(kv);
    for (let i = 0; i < MCP_ANON_LIMITS.rpm; i++) {
      expect((await call(e, "203.0.113.7")).status).toBe(200);
    }
    const blocked = await call(e, "203.0.113.7");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(handleMcp).toHaveBeenCalledTimes(MCP_ANON_LIMITS.rpm);
    expect(kv.keys().some(k => k.startsWith("rl:mcp:ip:203.0.113.7:"))).toBe(true);
  });

  it("budgets each address separately", async () => {
    const e = env();
    for (let i = 0; i < MCP_ANON_LIMITS.rpm; i++) await call(e, "198.51.100.1");
    expect((await call(e, "198.51.100.1")).status).toBe(429);
    expect((await call(e, "198.51.100.2")).status).toBe(200);
  });
});
