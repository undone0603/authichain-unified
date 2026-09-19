import { describe, it, expect } from "vitest";
import {
  HIGH_LEVERAGE_LEAD_SOURCE,
  HIGH_LEVERAGE_TARGETS,
  assertHighLeverageRunAllowed,
  loadHighLeverageFile,
  shouldLoadHighLeverageTargets,
} from "./high-leverage.ts";

describe("high-leverage Tier 1 list", () => {
  it("loads exactly the five owner-supplied emails", () => {
    expect(HIGH_LEVERAGE_LEAD_SOURCE).toBe("high_leverage_scan_2026-09-19");
    expect(HIGH_LEVERAGE_TARGETS).toHaveLength(5);
    expect(HIGH_LEVERAGE_TARGETS.map(t => t.email)).toEqual([
      "scott.krupa@fastsigns.com",
      "mark.jameson@fastsigns.com",
      "info@stashstock.com",
      "wendy.linscott@curaleaf.com",
      "klong@c3industries.com",
    ]);
    for (const target of HIGH_LEVERAGE_TARGETS) {
      expect(["buyer", "channel"]).toContain(target.role);
    }
  });

  it("rejects an invented extra address", () => {
    expect(() =>
      loadHighLeverageFile(
        JSON.stringify({
          source: HIGH_LEVERAGE_LEAD_SOURCE,
          generated: "2026-09-19",
          targets: [
            {
              company: "Guess Co",
              name: "Guess",
              email: "compliance@guess.example",
              segment: "strainchain",
              role: "buyer",
              notes: "invented",
              source: "unknown",
            },
          ],
        })
      )
    ).toThrow(/not in the owner-supplied Tier 1 set/);
  });
});

describe("high-leverage segment gate", () => {
  it("does not load for all / product / partners segments", () => {
    expect(shouldLoadHighLeverageTargets("all")).toBe(false);
    expect(shouldLoadHighLeverageTargets("govchain")).toBe(false);
    expect(shouldLoadHighLeverageTargets("strainchain")).toBe(false);
    expect(shouldLoadHighLeverageTargets("qron")).toBe(false);
    expect(shouldLoadHighLeverageTargets("partners")).toBe(false);
    expect(shouldLoadHighLeverageTargets("high_leverage")).toBe(true);
  });

  it("allows dry-run and refuses live", () => {
    expect(assertHighLeverageRunAllowed({ isDryRun: true })).toEqual({
      ok: true,
    });
    const denied = assertHighLeverageRunAllowed({ isDryRun: false });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.message).toMatch(/dry-run only/);
  });
});
