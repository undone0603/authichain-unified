import { afterEach, describe, expect, it } from "vitest";
import { tryHandleX402 } from "./x402-routes";
import type { FreeTierStore } from "../../../src/lib/x402-free-tier";

const SEAL = "11111111-2222-4333-8444-555555555555";
const ENV = {
  X402_PAY_TO: "0x5db5000000000000000000000000000000006aa2",
  X402_PRICE_USD: "0.05",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
  X402_FREE_IP_SALT: "test-salt",
};

/** In-memory store whose reserve() is check+insert with no await between, like the RPC under its lock. */
function memStore(): FreeTierStore & { rows: Array<{ key: string; at: Date }> } {
  const rows: Array<{ key: string; at: Date }> = [];
  return {
    rows,
    async reserve(key, since, limit, now) {
      await Promise.resolve();
      const used = rows.filter(r => r.key === key && r.at >= since).length;
      if (used >= limit) return { granted: false, used };
      rows.push({ key, at: now });
      return { granted: true, used: used + 1 };
    },
  };
}

const sealFetch = (async () =>
  new Response(JSON.stringify([{ id: SEAL, product_id: "p", batch_id: "b", brand: "x", created_at: "2026-10-01T00:00:00Z" }]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })) as unknown as typeof fetch;

function call(ip = "203.0.113.7") {
  return new Request("https://authichain.com/api/x402", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ sealId: SEAL }),
  });
}

afterEach(() => {
  delete process.env.X402_PAY_TO;
  delete process.env.X402_FREE_DAILY_CALLS;
});

describe("x402 free daily calls", () => {
  it("calls 1-3 are free, call 4 returns 402", async () => {
    const store = memStore();
    const now = new Date("2026-10-16T15:00:00Z");
    const remaining: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = (await tryHandleX402(call(), ENV, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!;
      expect(res.status).toBe(200);
      const body = (await res.json()) as { free: boolean; registered: boolean };
      expect(body.free).toBe(true);
      remaining.push(res.headers.get("X-Free-Calls-Remaining")!);
    }
    expect(remaining).toEqual(["2", "1", "0"]);
    const fourth = (await tryHandleX402(call(), ENV, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!;
    expect(fourth.status).toBe(402);
    expect(fourth.headers.get("X-Free-Calls-Remaining")).toBe("0");
  });

  it("rotating claimed wallets does not reset the per-IP allowance", async () => {
    const store = memStore();
    const now = new Date("2026-10-16T15:00:00Z");
    for (let i = 0; i < 3; i++) {
      const r = call();
      r.headers.set("X-Payer", `0x${String(i).repeat(40)}`);
      expect((await tryHandleX402(r, ENV, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!.status).toBe(200);
    }
    const r = call();
    r.headers.set("X-Payer", "0x" + "9".repeat(40));
    expect((await tryHandleX402(r, ENV, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!.status).toBe(402);
  });

  it("the counter resets the next UTC day", async () => {
    const store = memStore();
    const day1 = new Date("2026-10-16T23:59:00Z");
    for (let i = 0; i < 3; i++) await tryHandleX402(call(), ENV, undefined, { freeStore: store, now: day1, fetchImpl: sealFetch });
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: store, now: day1, fetchImpl: sealFetch }))!.status).toBe(402);
    const day2 = new Date("2026-10-17T00:01:00Z");
    const res = (await tryHandleX402(call(), ENV, undefined, { freeStore: store, now: day2, fetchImpl: sealFetch }))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Free-Calls-Remaining")).toBe("2");
  });

  it("a store error fails closed to 402", async () => {
    const broken: FreeTierStore = { async reserve() { return null; } };
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: broken, fetchImpl: sealFetch }))!.status).toBe(402);
    const throwing: FreeTierStore = { async reserve() { throw new Error("down"); } };
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: throwing, fetchImpl: sealFetch }))!.status).toBe(402);
    const denied: FreeTierStore = { async reserve() { return { granted: false, used: 0 }; } };
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: denied, fetchImpl: sealFetch }))!.status).toBe(402);
  });

  it("10 parallel calls from one IP grant at most 3 free (atomic reserve)", async () => {
    const store = memStore();
    const now = new Date("2026-10-16T15:00:00Z");
    const res = await Promise.all(
      Array.from({ length: 10 }, () => tryHandleX402(call(), ENV, undefined, { freeStore: store, now, fetchImpl: sealFetch }))
    );
    const statuses = res.map(r => r!.status);
    expect(statuses.filter(s => s === 200).length).toBe(3);
    expect(statuses.filter(s => s === 402).length).toBe(7);
    expect(store.rows.length).toBe(3);
  });

  it("supabase store calls the RPC and fails closed on bad replies", async () => {
    const { supabaseFreeTierStore } = await import("../../../src/lib/x402-free-tier");
    const calls: string[] = [];
    const mk = (status: number, body: unknown) =>
      (async (url: string) => {
        calls.push(String(url));
        return new Response(JSON.stringify(body), { status });
      }) as unknown as typeof fetch;
    const creds = { url: "https://example.supabase.co", key: "service-test", role: "service" as const };
    const since = new Date("2026-10-16T00:00:00Z");
    const ok = supabaseFreeTierStore(creds, mk(200, { granted: true, used: 1 }))!;
    expect(await ok.reserve("ip:x", since, 3, since)).toEqual({ granted: true, used: 1 });
    expect(calls[0]).toBe("https://example.supabase.co/rest/v1/rpc/x402_claim_free_call");
    expect(await supabaseFreeTierStore(creds, mk(500, {}))!.reserve("ip:x", since, 3, since)).toBeNull();
    expect(await supabaseFreeTierStore(creds, mk(200, { granted: "yes" }))!.reserve("ip:x", since, 3, since)).toBeNull();
    expect(supabaseFreeTierStore({ ...creds, role: "anon" as const })).toBeNull();
  });

  it("missing or empty X402_FREE_IP_SALT fails closed to 402 and writes nothing", async () => {
    for (const salt of [undefined, "", "   "]) {
      const store = memStore();
      const env: Record<string, string | undefined> = { ...ENV, X402_FREE_IP_SALT: salt };
      if (salt === undefined) delete env.X402_FREE_IP_SALT;
      const res = (await tryHandleX402(call(), env as typeof ENV, undefined, { freeStore: store, fetchImpl: sealFetch }))!;
      expect(res.status).toBe(402);
      expect(store.rows.length).toBe(0);
    }
  });

  it("daily key: same IP, same UTC day -> same key; different day -> different key", async () => {
    const { hashClientIp } = await import("../../../src/lib/x402-free-tier");
    const ip = "203.0.113.7";
    const a = await hashClientIp(ip, "test-salt", new Date("2026-10-16T00:01:00Z"));
    const b = await hashClientIp(ip, "test-salt", new Date("2026-10-16T23:59:00Z"));
    const c = await hashClientIp(ip, "test-salt", new Date("2026-10-17T00:01:00Z"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    const store = memStore();
    await tryHandleX402(call(ip), ENV, undefined, { freeStore: store, now: new Date("2026-10-16T12:00:00Z"), fetchImpl: sealFetch });
    await tryHandleX402(call(ip), ENV, undefined, { freeStore: store, now: new Date("2026-10-17T12:00:00Z"), fetchImpl: sealFetch });
    expect(store.rows[0].key).not.toBe(store.rows[1].key);
  });

  it("missing CF-Connecting-IP pays", async () => {
    const r = new Request("https://authichain.com/api/x402", { method: "POST", body: JSON.stringify({ sealId: SEAL }) });
    expect((await tryHandleX402(r, ENV, undefined, { freeStore: memStore(), fetchImpl: sealFetch }))!.status).toBe(402);
  });

  it("X402_FREE_DAILY_CALLS overrides the default", async () => {
    const store = memStore();
    const now = new Date("2026-10-16T15:00:00Z");
    const env = { ...ENV, X402_FREE_DAILY_CALLS: "1" };
    expect((await tryHandleX402(call(), env, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!.status).toBe(200);
    expect((await tryHandleX402(call(), env, undefined, { freeStore: store, now, fetchImpl: sealFetch }))!.status).toBe(402);
    const off = { ...ENV, X402_FREE_DAILY_CALLS: "0" };
    expect((await tryHandleX402(call("198.51.100.1"), off, undefined, { freeStore: memStore(), now, fetchImpl: sealFetch }))!.status).toBe(402);
  });

  it("anon-only credentials never grant free calls (ledger not writable)", async () => {
    const env = { X402_PAY_TO: ENV.X402_PAY_TO, SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: "anon" };
    expect((await tryHandleX402(call(), env, undefined, { fetchImpl: sealFetch }))!.status).toBe(402);
  });
});
