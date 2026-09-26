/**
 * Goal placeholder: 5-agent consensus on top of a real seal score.
 * Live evidence today = product row + optional JWKS/receipt flags.
 * Agent notes MUST set simulated:true until each agent has a real signal.
 */

export const AGENTS = [
  { id: "guardian", name: "Guardian", weight: 0.35, role: "integrity" },
  { id: "sentinel", name: "Sentinel", weight: 0.25, role: "anomaly" },
  { id: "archivist", name: "Archivist", weight: 0.2, role: "record" },
  { id: "arbiter", name: "Arbiter", weight: 0.12, role: "verdict" },
  { id: "scout", name: "Scout", weight: 0.08, role: "context" },
] as const;

export type ScoreInput = {
  product: { is_active?: boolean; story?: string; token_id?: number } | null;
  jwsValid?: boolean;
  receiptOk?: boolean;
  jwksLive?: boolean;
};

export type AgentNote = {
  id: string;
  name: string;
  weight: number;
  role: string;
  vote: "support" | "abstain" | "reject";
  simulated: true;
  goal: string;
};

export function scoreSeal(input: ScoreInput) {
  if (!input.product) {
    return {
      authentic: false,
      trust_score: 10,
      confidence: "Low" as const,
      actions: ["retry_scan", "contact_support"],
      message: "Product not found",
      goal: "seal_row",
      anchored: false,
    };
  }
  if (input.product.is_active === false) {
    return {
      authentic: false,
      trust_score: 30,
      confidence: "Low" as const,
      actions: ["retry_scan", "contact_support"],
      message: "Product inactive",
      goal: "reactivate",
      anchored: false,
    };
  }

  let trust = 55;
  const actions = ["claim_ownership", "launch_ar"];
  if (input.product.story) actions.unshift("view_story");
  if (input.jwsValid) trust = 80;
  if (input.jwsValid && input.receiptOk) trust = 95;

  return {
    authentic: true,
    trust_score: trust,
    confidence: (trust >= 80 ? "High" : "Medium") as "High" | "Medium",
    actions,
    message: trust >= 80 ? "Verified" : "Registered — signature pending",
    goal: trust >= 95 ? "complete" : "jwks_and_receipt",
    anchored: Boolean(input.receiptOk),
  };
}

export function agentNotes(score: ReturnType<typeof scoreSeal>): AgentNote[] {
  return AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    weight: agent.weight,
    role: agent.role,
    vote: score.authentic ? ("support" as const) : ("abstain" as const),
    simulated: true,
    goal: `real_${agent.id}_signal`,
  }));
}
