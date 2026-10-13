import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runFounderExitDrill } from "./ledger";

describe("founder exit drill", () => {
  it("recovers the interrupted action once and keeps blockers visible", () => {
    const report = runFounderExitDrill();
    const failed = Object.entries({
      ...report.criteria,
      ...report.faults,
    }).filter(([, value]) => value !== "pass");
    expect(failed).toEqual([]);
    expect(report.production_side_effects).toBe(false);
    expect(report.stripe_called).toBe(false);
    expect(report.mail_sent).toBe(false);
    expect(report.migration_applied).toBe(false);
    expect(report.side_effect_applications).toBe(1);
    expect(report.duplicate_side_effects).toBe(1);
    expect(report.final_state).toBe("succeeded");
    expect(report.verification_status).toBe("verified");
    expect(report.economic.demo_zero.payment).toBe("simulated");
    expect(report.economic.founder_1000.recognized_revenue).toBe("blocked");
    expect(report.economic.unverified_entitlement.payment).toBe("unknown");
    const committed = JSON.parse(
      readFileSync("docs/evidence/founder-exit-drill.json", "utf8")
    );
    expect(report).toEqual(committed);
  });
});
