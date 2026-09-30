/**
 * grant-map.ts duplicates catalogue and loop constants on purpose (this Worker
 * does not import src/lib). Duplication only stays safe if drift is caught, so
 * these tests compare the duplicate against the real source of truth.
 */
import { describe, expect, it } from "vitest";
import { FOUNDER_EMAILS, LOOP_BY_PLAN, isFounderEmail, loopForPlan } from "./grant-map";
import { GROWTH_LOOPS } from "../../../src/lib/growth/loops";
import { FOUNDER_EMAILS as CANONICAL_FOUNDERS } from "../../../src/lib/billing/live-catalog";

describe("loop identity stays in lockstep with src/lib/growth/loops.ts", () => {
  it("covers exactly the skus that have a loop", () => {
    expect(Object.keys(LOOP_BY_PLAN).sort()).toEqual(GROWTH_LOOPS.map(l => l.sku).sort());
  });

  it("maps each sku to the right loop id", () => {
    for (const loop of GROWTH_LOOPS) {
      expect(loopForPlan(loop.sku)!.loop).toBe(loop.id);
    }
  });

  it("names a purchase event that the loop actually declares", () => {
    for (const loop of GROWTH_LOOPS) {
      const { purchaseEvent } = loopForPlan(loop.sku)!;
      expect(loop.events).toContain(purchaseEvent);
      expect(purchaseEvent).toMatch(/^purchase_.+_succeeded$/);
    }
  });

  it("returns null for plans with no loop", () => {
    for (const plan of ["creator", "qron_launch", "strainchain_farm", "free", ""]) {
      expect(loopForPlan(plan)).toBeNull();
    }
    expect(loopForPlan(null)).toBeNull();
    expect(loopForPlan(undefined)).toBeNull();
  });
});

describe("founder list stays in lockstep with live-catalog.ts", () => {
  it("matches exactly", () => {
    expect([...FOUNDER_EMAILS].sort()).toEqual([...CANONICAL_FOUNDERS].sort());
  });

  it("detects founders case- and whitespace-insensitively", () => {
    expect(isFounderEmail("  AuthiChain@Gmail.com ")).toBe(true);
    expect(isFounderEmail("undone.k@gmail.com")).toBe(true);
    expect(isFounderEmail("buyer@example.com")).toBe(false);
    expect(isFounderEmail(null)).toBe(false);
    expect(isFounderEmail(undefined)).toBe(false);
  });
});
