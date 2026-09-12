import { describe, expect, it } from "vitest";
import { buildOrchestrationPlan } from "./orchestrator";

describe("autonomous orchestrator", () => {
  it("selects DPP workflow for battery passport demand", () => {
    const plan = buildOrchestrationPlan({ description: "German battery manufacturer needs a battery passport" });
    expect(plan.circumstance).toBe("battery");
    expect(plan.offer).toContain("Battery DPP");
    expect(plan.agents).toEqual(expect.arrayContaining(["research", "evidence", "fit", "revenue"]));
  });

  it("routes pharmaceutical traceability to DSCSA", () => {
    const plan = buildOrchestrationPlan({ description: "US pharmaceutical distributor needs DSCSA traceability" });
    expect(plan.circumstance).toBe("pharma");
    expect(plan.offer).toContain("DSCSA");
  });

  it("requires human review when no specific circumstance is known", () => {
    const plan = buildOrchestrationPlan({ description: "We need help with our supply chain", privacy: "high" });
    expect(plan.circumstance).toBe("unknown");
    expect(plan.humanReview).toBe(true);
  });
});
