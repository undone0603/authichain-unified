import { PolicyRule } from ".";
import { Evidence } from "@authichain/evidence";

export const MandatoryEvidenceRule: PolicyRule = {
  id: "rule_mandatory_evidence",
  name: "Mandatory Evidence Check",
  description: "Requires at least one manufacturing and one inspection event.",
  evaluate: (evidence: Evidence[]) => {
    const hasManufacturing = evidence.some(e => e.type === "manufacturing");
    const hasInspection = evidence.some(e => e.type === "inspection");
    return hasManufacturing && hasInspection;
  },
};
