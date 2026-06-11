/**
 * AgentZ Commander Service
 * (c) 2026 AuthiChain Inc.
 * 
 * Processes high-level strategic directives from the Governor (User).
 */
import { logActivity } from "../db";
import { createMission } from "../missions/missions.db";

export interface DirectiveOptions {
  userId: number;
  text: string;
  focusVertical?: string;
}

export async function processDirective(options: DirectiveOptions) {
  const { text, userId } = options;
  console.log('[Commander] Processing Directive: "' + text + '"');

  // Log the directive as a strategic event
  await logActivity({
    userId,
    action: "strategic_directive_received",
    entityType: "agentz",
    details: { text }
  });

  // Basic Directive Classification Logic
  let missionType: any = "REVENUE_OPS";
  let workflowId = "twitter_truth_shilling";

  if (text.toLowerCase().includes("grant")) {
    workflowId = "arbitrum_grant_outreach";
  } else if (text.toLowerCase().includes("cannabis") || text.toLowerCase().includes("strain")) {
    workflowId = "linkedin_strainchain_outreach";
  } else if (text.toLowerCase().includes("gov") || text.toLowerCase().includes("sam")) {
    workflowId = "sam_gov_dhs_submit";
  }

  // Auto-create a mission based on the directive
  const result = await createMission({
    userId,
    title: 'Directive: ' + text.substring(0, 30) + '...',
    description: 'Executing strategic governor directive: "' + text + '"',
    type: missionType,
    tasks: [
      { kind: "AGENTZ_EXTERNAL", payload: { workflowId, args: [text] } }
    ]
  });

  return {
    success: true,
    actionTaken: "Strategic Mission Created: " + result.title,
    missionId: result.id,
    executingWorkflow: workflowId
  };
}
