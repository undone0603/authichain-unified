export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyCondition {
  field: string;
  operator: "EQUALS" | "CONTAINS" | "IN" | "GREATER_THAN" | "EXISTS";
  value: any;
}

export interface PolicyRule {
  id: string;
  description?: string;
  effect: PolicyEffect;
  roles?: string[];
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[];
}

export interface PolicyContext {
  agentId: string;
  role: string;
  action: string;
  resource: string;
  attestationStatus?: string;
  attributes?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  matchedRuleId?: string;
  reason: string;
  evaluatedAt: string;
}
