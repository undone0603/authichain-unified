/**
 * Circumstance-aware orchestration for AuthiChain.
 *
 * Deliberately provider-neutral: model execution stays behind the adapter so
 * local/open models and hosted models can be swapped without changing policy.
 */

export type Circumstance =
  | "dpp"
  | "pharma"
  | "medical_device"
  | "battery"
  | "textile"
  | "authentication"
  | "government"
  | "unknown";

export type Risk = "low" | "medium" | "high";

export interface OrchestrationInput {
  description: string;
  regulatoryUrgency?: number;
  privacy?: Risk;
  budget?: Risk;
  buyingSignal?: number;
  existingData?: number;
}

export interface OrchestrationPlan {
  circumstance: Circumstance;
  confidence: number;
  agents: string[];
  tools: string[];
  offer: string;
  humanReview: boolean;
  rationale: string[];
}

const rules: Array<{ circumstance: Circumstance; terms: string[]; offer: string; agents: string[]; tools: string[] }> = [
  { circumstance: "pharma", terms: ["pharma", "pharmaceutical", "drug", "dsCSA", "prescription"], offer: "AuthiChain DSCSA / traceability assessment", agents: ["research", "evidence", "fit", "revenue"], tools: ["rag", "web", "hubspot"] },
  { circumstance: "medical_device", terms: ["medical device", "device", "udi", "fda"], offer: "AuthiChain medical-device traceability assessment", agents: ["research", "evidence", "fit", "revenue"], tools: ["rag", "web", "hubspot"] },
  { circumstance: "battery", terms: ["battery", "batteries", "battery passport"], offer: "EU Battery DPP Readiness Audit", agents: ["research", "evidence", "fit", "revenue"], tools: ["rag", "web", "hubspot", "stripe"] },
  { circumstance: "textile", terms: ["textile", "fashion", "apparel", "garment", "clothing"], offer: "EU Textile DPP Readiness Audit", agents: ["research", "evidence", "fit", "revenue"], tools: ["rag", "web", "hubspot", "stripe"] },
  { circumstance: "authentication", terms: ["counterfeit", "counterfeiting", "authenticity", "authentication", "provenance"], offer: "AuthiChain Product Authentication Pilot", agents: ["research", "evidence", "fit", "revenue"], tools: ["web", "hubspot", "stripe"] },
  { circumstance: "government", terms: ["government", "municipal", "federal", "procurement", "grant", "sbir"], offer: "AuthiChain Government Traceability Pilot", agents: ["research", "evidence", "fit", "revenue"], tools: ["web", "hubspot"] },
  { circumstance: "dpp", terms: ["dpp", "digital product passport", "espr", "product passport"], offer: "EU DPP Readiness Audit", agents: ["research", "evidence", "fit", "revenue"], tools: ["rag", "web", "hubspot", "stripe"] },
];

function scoreMatch(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
}

export function buildOrchestrationPlan(input: OrchestrationInput): OrchestrationPlan {
  const ranked = rules
    .map((rule) => ({ rule, score: scoreMatch(input.description, rule.terms) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score === 0) {
    return {
      circumstance: "unknown",
      confidence: 0.2,
      agents: ["research", "fit"],
      tools: ["web"],
      offer: "AuthiChain discovery assessment",
      humanReview: true,
      rationale: ["No circumstance-specific signal was detected; gather evidence before selecting an offer."],
    };
  }

  const confidence = Math.min(0.98, 0.55 + best.score * 0.12 + (input.regulatoryUrgency ?? 0) * 0.001);
  const highRisk = input.privacy === "high" || confidence < 0.75;

  return {
    circumstance: best.rule.circumstance,
    confidence,
    agents: best.rule.agents,
    tools: best.rule.tools,
    offer: best.rule.offer,
    humanReview: highRisk,
    rationale: [
      `${best.score} circumstance signal(s) matched the description.`,
      "Evidence and fit scoring precede commercial action.",
      highRisk ? "Human review is required because confidence/privacy risk is elevated." : "Routine execution may proceed automatically.",
    ],
  };
}
