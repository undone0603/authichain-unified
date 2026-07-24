import type { Db } from "../db-helpers";
import { getLeadById, updateLead, createMission, createTask } from "../db-helpers";

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.[0] ?? ''}***@${domain}`;
}

/**
 * Lead Scoring Service — Ported from legacy AgentZ Sales System
 * Calculates a lead's "Truth Score" (0-100) based on engagement.
 */
export async function calculateLeadScore(db: Db, leadId: number): Promise<number> {
  // In our unified schema, "leads" are often represented by "users" with a specific role
  // or stored in the 'leads' table if it exists.
  // For this implementation, we'll assume a 'leads' table with activity tracking.

  const lead = await getLeadById(db, leadId);
  if (!lead) return 0;

  let score = 0;

  // 1. Email Engagement (Instantly.ai / Gmail)
  if (lead.emailOpened) score += 10;
  if (lead.emailClicked) score += 20;
  if (lead.emailReplied) score += 15;

  // 2. Platform Engagement
  if (lead.roiCalculated) score += 20;
  if (lead.demoStarted) score += 10;

  // interaction score (max 15)
  const interactions = lead.interactionsCount || 0;
  score += Math.min(15, interactions * 3);

  // 3. Manual qualification
  if (lead.isVip) score += 10;

  // Cap at 100
  const finalScore = Math.min(100, score);

  // Update lead with new score
  await updateLead(db, leadId, {
    leadScore: finalScore,
    status: finalScore >= 70 ? "HOT" : finalScore >= 40 ? "WARM" : "COLD"
  });

  // Auto-trigger contract for hot leads
  if (finalScore >= 70 && !lead.contractSent) {
    console.log(`[Sales Automation] HOT lead detected: ${maskEmail(lead.email || '')}. Triggering contract...`);
    await triggerAutoContract(db, leadId);
  }

  return finalScore;
}

/**
 * Triggers an automated contract via DocuSign Mission
 */
async function triggerAutoContract(db: Db, leadId: number) {
  const lead = await getLeadById(db, leadId);
  if (!lead) return;

  // We use the mission system to handle the contract sending as an async task
  const missionId = await createMission(db, "LUXURY_OUTREACH");

  await createTask(db, {
    missionId,
    kind: "GENERATE_PROPOSAL", // This task will be handled by the DocuSign service
    priority: 1,
    status: "PENDING",
    payload: {
      leadId,
      email: lead.email,
      name: lead.name,
      company: lead.company,
      numProducts: lead.numProducts || 1000,
      applyDiscount: true
    }
  });
}
