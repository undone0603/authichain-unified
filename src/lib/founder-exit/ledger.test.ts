import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  attemptAction,
  ContinuityLog,
  runFounderExitDrill,
  type AgentIdentity,
} from "./ledger";

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

  it("rolls the stored row back when the commit hook throws", () => {
    let calls = 0;
    const log = new ContinuityLog(() => {
      calls += 1;
      if (calls === 2) throw new Error("flush_failed");
    });
    const agent: AgentIdentity = {
      agent_id: "agent-rollback",
      identity_version: "1",
      capabilities: ["inspect"],
      revoked: false,
    };
    expect(() =>
      attemptAction(
        log,
        {
          action_id: "act_rollback",
          idempotency_key: "rollback-1",
          action_type: "inspect",
          agent,
          correlation_id: "corr-rollback",
          measurement_definition: "commit hook failure leaves the prior row",
        },
        new Date("2026-10-13T20:00:00.000Z")
      )
    ).toThrow("flush_failed");
    const row = log.ledger.get("act_rollback");
    expect(row?.state).toBe("queued");
    expect(row?.history).toHaveLength(1);
  });
});
