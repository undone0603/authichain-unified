import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { usdToAtomic } from "./x402";
import {
  SIGNAL_LEDGER,
  resolveTierRequest,
  shapeTierAnswer,
  stableStringify,
} from "./x402-tiers";

const URL_BASE = "https://authichain.com/api/x402";

describe("resolveTierRequest", () => {
  it("defaults to verify at the configured price when no tier is given", () => {
    expect(resolveTierRequest(URL_BASE, 0.05)).toEqual({
      ok: true,
      tier: "verify",
      priceUsd: 0.05,
    });
    expect(resolveTierRequest(`${URL_BASE}?tier=`, 0.07)).toEqual({
      ok: true,
      tier: "verify",
      priceUsd: 0.07,
    });
  });

  it("prices ping at $0.01 and evidence at $0.10 regardless of X402_PRICE_USD", () => {
    const ping = resolveTierRequest(`${URL_BASE}?tier=ping`, 0.07);
    const ev = resolveTierRequest(`${URL_BASE}?tier=EVIDENCE`, 0.07);
    expect(ping).toMatchObject({ ok: true, tier: "ping", priceUsd: 0.01 });
    expect(ev).toMatchObject({ ok: true, tier: "evidence", priceUsd: 0.1 });
    // exact atomic USDC (6 decimals): no float drift
    expect(usdToAtomic(0.01)).toBe("10000");
    expect(usdToAtomic(0.05)).toBe("50000");
    expect(usdToAtomic(0.1)).toBe("100000");
  });

  it("refuses an unknown tier with 400 before any quote", () => {
    expect(resolveTierRequest(`${URL_BASE}?tier=free`, 0.05)).toMatchObject({
      ok: false,
      status: 400,
      body: { error: "unknown_tier" },
    });
  });

  it("accepts a bare tier value (MCP arguments)", () => {
    expect(resolveTierRequest("ping", 0.05)).toMatchObject({
      ok: true,
      tier: "ping",
    });
  });

  it("keeps the legacy ledger name for verify and separates the others", () => {
    expect(SIGNAL_LEDGER.verify).toBe("x402_spend");
    expect(new Set(Object.values(SIGNAL_LEDGER)).size).toBe(3);
  });
});

describe("shapeTierAnswer", () => {
  const answer = {
    registered: true,
    status: "registered",
    verified: false,
    baseline: { verdict: "unsigned", unknowns: ["x"] },
  };

  it("returns the verify baseline untouched", () => {
    expect(shapeTierAnswer("verify", answer)).toBe(answer);
  });

  it("ping reveals registry existence only", () => {
    const out = shapeTierAnswer("ping", answer, "2026-11-13T00:00:00.000Z");
    expect(out).toEqual({
      tier: "ping",
      registered: true,
      status: "registered",
      scope: "registry-existence",
      checkedAt: "2026-11-13T00:00:00.000Z",
    });
    expect(out).not.toHaveProperty("baseline");
    expect(out).not.toHaveProperty("verified");
  });

  it("evidence adds a reproducible digest and never claims verified", () => {
    const out = shapeTierAnswer("evidence", answer) as Record<string, any>;
    expect(out.verified).toBe(false);
    const { tier: _t, evidence: _e, ...rest } = out;
    expect(out.evidence.digest).toBe(
      createHash("sha256").update(stableStringify(rest)).digest("hex")
    );
  });

  it("stableStringify ignores key order", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 })
    );
  });
});
