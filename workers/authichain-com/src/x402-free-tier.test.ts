import { afterEach, describe, expect, it } from "vitest";
import { tryHandleX402 } from "./x402-routes";
import type { FreeTierStore } from "../../../src/lib/x402-free-tier";

const SEAL = "11111111-2222-4333-8444-555555555555";
const ENV = {
  X402_PAY_TO: "0x5db5000000000000000000000000000000006aa2",
  X402_PRICE_USD: "0.05",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
};

function memStore(): FreeTierStore & { rows: Array<{ key: string; at: Date }> } {
  const rows: Array<{ key: string; at: Date }> = [];
  return {
    rows,
    async count(key, since) {
      return rows.filter(r => r.key === key && r.at >= since).length;
    },
    async record(key, now) {
      rows.push({ key, at: now });
      return true;
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
    const broken: FreeTierStore = {
      async count() { return null; },
      async record() { return true; },
    };
    const res = (await tryHandleX402(call(), ENV, undefined, { freeStore: broken, fetchImpl: sealFetch }))!;
    expect(res.status).toBe(402);
    const throwing: FreeTierStore = {
      async count() { throw new Error("down"); },
      async record() { return true; },
    };
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: throwing, fetchImpl: sealFetch }))!.status).toBe(402);
    const noWrite: FreeTierStore = { async count() { return 0; }, async record() { return false; } };
    expect((await tryHandleX402(call(), ENV, undefined, { freeStore: noWrite, fetchImpl: sealFetch }))!.status).toBe(402);
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
