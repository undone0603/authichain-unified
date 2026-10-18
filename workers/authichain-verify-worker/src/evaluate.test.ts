import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluate as protocolEvaluate } from "../../../protocol/trust-kernel/evaluate";
import { evaluate as protocolMjs } from "../../../protocol/trust-kernel/evaluate.mjs";
import { evaluate as workerEvaluate } from "./evaluate";

const digest = "sha256:" + createHash("sha256").update("inspection").digest("hex");

describe("evaluate physical binding", () => {
  it("an inspection row does not set the physical binding", () => {
    const input = {
      objectFound: true,
      evidence: [{ type: "inspection", digest }],
    };
    for (const evaluate of [workerEvaluate, protocolEvaluate, protocolMjs]) {
      const out = evaluate(input);
      expect(out.vector.physical_binding).toBe("unknown");
      expect(out.unknowns).toContain("physical_binding_not_inspected");
      expect(out.unknowns).not.toContain("physical_condition_not_fully_inspected");
    }
  });
});
