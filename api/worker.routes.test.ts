import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./worker";

const env = { WORKER_API_KEY: "k_test", STRIPE_WEBHOOK_SECRET: "whsec_t" } as unknown as Env;
const post = (p: string, h: Record<string, string> = {}) =>
  new Request(`https://api.example.test${p}`, { method: "POST", headers: h, body: "{}" });

describe("revenue worker routes (fix for 40516a11)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("/api/verify and /api/scan return 501 with zero outbound (Stripe) calls", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    for (const p of ["/api/verify", "/api/scan", "/api/verify/x"]) {
      for (const m of ["GET", "POST"]) {
        const r = await worker.fetch(new Request(`https://api.example.test${p}`, { method: m }), env);
        expect(r.status).toBe(501);
      }
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("has no scheduled() handler", () => {
    expect("scheduled" in worker).toBe(false);
  });

  it("keeps x-api-key guard on /stripe/checkout (no Stripe call when unauthenticated)", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const r = await worker.fetch(post("/stripe/checkout"), env);
    expect(r.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps webhook signature check, /verify public, /sales/inbound own-secret, /health", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect((await worker.fetch(post("/stripe/webhook"), env)).status).toBe(400);
    expect((await worker.fetch(post("/verify"), env)).status).not.toBe(401);
    expect((await worker.fetch(post("/sales/inbound"), env)).status).not.toBe(401);
    expect((await worker.fetch(new Request("https://api.example.test/health", { headers: { "x-api-key": "k_test" } }), env)).status).toBe(200);
    expect((await worker.fetch(new Request("https://api.example.test/health"), env)).status).toBe(401);
    expect(f.mock.calls.filter((c) => String(c[0]).includes("stripe.com"))).toHaveLength(0);
  });
});
