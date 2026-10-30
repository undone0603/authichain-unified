import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/checkout-protection", () => ({
  claimCheckoutAttempt: async () => ({ allowed: true }),
  recordCheckoutSession: async () => true,
}));

import { planFromGatedPath } from "../src/lib/checkout-gate";
import { PUBLIC_PROBES, probePublic } from "./cloudflare-production-health.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const pathOf = probe => new URL(probe.url).pathname;

describe("production health probes target routes that exist", () => {
  it("every /checkout/* probe is the canonical path of a gated plan (aliases 301)", () => {
    const probes = PUBLIC_PROBES.filter(p =>
      pathOf(p).startsWith("/checkout/")
    );
    expect(probes.length).toBeGreaterThan(0);
    for (const probe of probes) {
      const plan = planFromGatedPath(pathOf(probe));
      expect(plan, probe.id).toBeTruthy();
      expect(pathOf(probe), probe.id).toBe(`/checkout/${plan.id}`);
    }
  });

  it("every /api/checkout/* probe has a route handler in src/app/api/checkout", () => {
    const probes = PUBLIC_PROBES.filter(p =>
      pathOf(p).startsWith("/api/checkout/")
    );
    for (const probe of probes) {
      const name = pathOf(probe).replace("/api/checkout/", "");
      const route = path.join(
        repoRoot,
        "src/app/api/checkout",
        name,
        "route.ts"
      );
      expect(existsSync(route), `${probe.id}: missing ${route}`).toBe(true);
    }
  });

  it("never probes the non-existent /api/checkout/launch (404 on 2026-10-22)", () => {
    expect(PUBLIC_PROBES.map(pathOf)).not.toContain("/api/checkout/launch");
  });
});

describe("probePublic", () => {
  it("reports ok only for accepted statuses and surfaces thrown errors as status 0", async () => {
    const fetchImpl = vi.fn(async url => {
      if (String(url).endsWith("/pricing")) throw new Error("boom");
      if (String(url).includes("/checkout/"))
        return new Response(null, { status: 404 });
      return new Response(null, {
        status: PUBLIC_PROBES.find(p => p.url === url).accept[0],
      });
    });
    const results = await probePublic(fetchImpl);
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    expect(byId.apex.ok).toBe(true);
    expect(byId.pricing).toMatchObject({
      ok: false,
      status: 0,
      detail: "boom",
    });
    expect(byId.checkout_launch_annual_confirm_head).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("uses HEAD for checkout probes so the check can never open a Stripe session", async () => {
    const methods = {};
    await probePublic(async (url, init) => {
      methods[new URL(url).pathname] = init.method;
      return new Response(null, { status: 200 });
    });
    for (const probe of PUBLIC_PROBES.filter(p =>
      pathOf(p).includes("/checkout/")
    )) {
      expect(methods[pathOf(probe)], probe.id).toBe("HEAD");
    }
  });
});
