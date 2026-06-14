import { ENV } from "./_core/env";
import {
  computeLeadScore,
  logAutomationAudit,
  updateLeadScore,
  updateLeadStatus,
  upsertLeadByEmail,
} from "./db";

export type IncomingLead = {
  email: string;
  name?: string;
  company?: string;
  title?: string;
  phone?: string;
  source?: string;
  industry?: string;
  metadata?: Record<string, unknown>;
  signals?: {
    segmentFit?: number;
    intent?: number;
    urgency?: number;
    budgetProxy?: number;
  };
};

function suppressionSet() {
  return new Set(
    ENV.suppressionList
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean),
  );
}

function scoreToLeadStatus(score: number): "new" | "contacted" | "qualified" {
  if (score >= 80) return "qualified";
  if (score >= 50) return "contacted";
  return "new";
}

export async function ingestLeadAndRoute(input: IncomingLead) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const suppressed = suppressionSet().has(normalizedEmail);
  if (suppressed) {
    await logAutomationAudit("lead_suppressed", {
      email: normalizedEmail,
      source: input.source || "unknown",
      reason: "suppression_list",
    });
    return { accepted: false as const, reason: "suppressed" as const };
  }

  const upserted = await upsertLeadByEmail({
    ...input,
    email: normalizedEmail,
    source: input.source || "website_form",
  });
  await logAutomationAudit(upserted.created ? "lead_create" : "lead_update", {
    leadId: upserted.id,
    email: normalizedEmail,
    source: input.source || "website_form",
  });
  const scoring = computeLeadScore(input.signals || {});
  await updateLeadScore(upserted.id, scoring.score);
  const newStatus = scoreToLeadStatus(scoring.score);
  await updateLeadStatus(upserted.id, newStatus);

  await logAutomationAudit("lead_routed", {
    leadId: upserted.id,
    created: upserted.created,
    score: scoring.score,
    band: scoring.band,
    route: scoring.route,
    status: newStatus,
    source: input.source || "website_form",
  });

  // $0 TRIGGER: If lead is qualified, trigger autonomous outreach mission
  if (newStatus === "qualified") {
     const { createMission } = await import("./missions/missions.db");
     await createMission({
        userId: 1, // System Admin
        title: `High-Intent Outreach: ${normalizedEmail}`,
        description: `Lead from ${input.company || "Unknown"} scored ${scoring.score}. Triggering AgentZ sales sequence.`,
        type: "REVENUE_OPS" as any,
        tasks: [
           { kind: "AGENTZ_EXTERNAL", payload: { workflowId: "linkedin_strainchain_outreach", args: [normalizedEmail] } }
        ]
     });
  }

  return {
    accepted: true as const,
    leadId: upserted.id,
    created: upserted.created,
    score: scoring.score,
    band: scoring.band,
    route: scoring.route,
    status: newStatus,
  };
}
