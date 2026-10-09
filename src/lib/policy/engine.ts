import {
  PolicyRule,
  PolicyContext,
  PolicyEvaluationResult,
  PolicyCondition,
} from "./types";

export class PolicyEngine {
  private rules: PolicyRule[] = [];

  constructor(initialRules: PolicyRule[] = []) {
    this.rules = initialRules;
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  evaluate(context: PolicyContext): PolicyEvaluationResult {
    const evaluatedAt = new Date().toISOString();

    for (const rule of this.rules) {
      if (this.matchesRule(rule, context)) {
        const allowed = rule.effect === "ALLOW";
        return {
          allowed,
          matchedRuleId: rule.id,
          reason: allowed
            ? `Rule ${rule.id} allowed action '${context.action}' on '${context.resource}'`
            : `Rule ${rule.id} explicitly denied action '${context.action}' on '${context.resource}'`,
          evaluatedAt,
        };
      }
    }

    return {
      allowed: false,
      reason: `Default deny: No matching policy rule for action '${context.action}' on '${context.resource}'`,
      evaluatedAt,
    };
  }

  private matchesRule(rule: PolicyRule, context: PolicyContext): boolean {
    const actionMatches =
      rule.actions.includes("*") || rule.actions.includes(context.action);
    if (!actionMatches) return false;

    const resourceMatches =
      rule.resources.includes("*") || rule.resources.includes(context.resource);
    if (!resourceMatches) return false;

    if (rule.roles && rule.roles.length > 0) {
      if (!rule.roles.includes("*") && !rule.roles.includes(context.role)) {
        return false;
      }
    }

    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateCondition(
    condition: PolicyCondition,
    context: PolicyContext
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case "EQUALS":
        return fieldValue === condition.value;
      case "CONTAINS":
        return Array.isArray(fieldValue)
          ? fieldValue.includes(condition.value)
          : String(fieldValue).includes(String(condition.value));
      case "IN":
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case "GREATER_THAN":
        return fieldValue > condition.value;
      case "EXISTS":
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  private getFieldValue(fieldPath: string, context: PolicyContext): any {
    const parts = fieldPath.split(".");
    let current: any = context;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }
}
