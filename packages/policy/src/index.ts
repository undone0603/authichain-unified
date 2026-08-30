import { Evidence } from "@authichain/evidence";

export type PolicyDecision = "verified" | "warning" | "blocked";

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  evaluate: (evidence: Evidence[]) => boolean;
}

export interface PolicyDefinition {
  id: string;
  version: string;
  rules: PolicyRule[];
}

export class PolicyEngine {
  constructor(private policy: PolicyDefinition) {}

  evaluate(evidence: Evidence[]): PolicyDecision {
    const allPassed = this.policy.rules.every(rule => rule.evaluate(evidence));
    return allPassed ? "verified" : "blocked";
  }
}
