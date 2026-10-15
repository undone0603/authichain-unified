// Model Context Protocol (MCP) compatible Tool Registry
export const agentToolRegistry = [
  {
    name: "verify_battery_passport",
    description: "Verifies the compliance of a battery passport against SAM.gov and California DCA.",
    inputSchema: {
      type: "object",
      properties: {
        manufacturerId: { type: "string" },
        licenseNumber: { type: "string" }
      },
      required: ["manufacturerId", "licenseNumber"]
    }
  },
  {
    name: "check_budget_ledger",
    description: "Checks the D1 atomic budget ledger to ensure the agent has sufficient funds.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string" }
      },
      required: ["agentId"]
    }
  },
  {
    name: "trigger_stripe_webhook",
    description: "Triggers a Stripe webhook. Guardrail: STRICTLY requires a verified budget reservation nonce.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        nonce: { type: "string" }
      },
      required: ["customerId", "nonce"]
    }
  }
];

export function validateToolCall(toolName: string, budgetVerified: boolean): boolean {
  const tool = agentToolRegistry.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Guardrail Enforced: Tool '${toolName}' is not registered in the MCP manifest.`);
  }
  
  // Strict Guardrail: Prevent state mutations and API charges without a budget
  if (toolName === 'trigger_stripe_webhook' && !budgetVerified) {
    throw new Error("Guardrail Enforced: Cannot execute 'trigger_stripe_webhook' without a committed budget nonce.");
  }
  
  return true;
}
