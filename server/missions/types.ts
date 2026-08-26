export const MISSION_TYPES = [
  'GOV_PILOT',
  'RETAIL_PILOT',
  'PRESS_LAUNCH',
  'PARTNER_ONBOARDING',
  'TECH_OS_LOCK',
  'LAUNCH_AUTHICHAIN',
  'LUXURY_OUTREACH',
  'PHARMA_OUTREACH',
  'MEDTECH_OUTREACH',
  'TIMEPIECE_OUTREACH',
  'NEWSJACKING_LAUNCH',
  'TECH_SPRINT',
  'MEDTECH_VIDEO_BRIEFING',
  'MI_CRA_PARTNERSHIP',
] as const;
export type MissionType = typeof MISSION_TYPES[number];

export const MISSION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;

export type MissionStatus = typeof MISSION_STATUSES[number];

/**
 * The value `missions.status` actually stores for each MissionStatus.
 *
 * These two vocabularies are not the same word in a different case, and
 * assuming they were is a bug that shipped twice. Both updateMissionStatus()
 * implementations wrote `status.toLowerCase() as any`, producing 'planned',
 * 'in_progress' and 'blocked' — none of which missions_status_check permits:
 *
 *   CHECK (status = ANY (ARRAY['pending', 'active', 'completed', 'failed']))
 *
 * So three of the four possible arguments raised [23514] and only COMPLETED
 * ever worked. The `as any` is what let it past the type checker; the enum is
 * the odd one out, since all 522 existing rows and every insert path use the
 * database's vocabulary.
 *
 * 'blocked' has no counterpart in the original four and is added to the
 * constraint rather than folded into 'failed' — a mission waiting on something
 * is not a mission that failed, and collapsing them would lose that.
 */
export const MISSION_STATUS_TO_DB: Record<MissionStatus, string> = {
  PLANNED: 'pending',
  IN_PROGRESS: 'active',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
};

export const TASK_STATUSES = ['PENDING', 'RUNNING', 'WAITING_HUMAN', 'DONE', 'FAILED'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export type TaskKind =
  | 'FIND_GOV_LEADS'
  | 'FIND_RETAIL_LEADS'
  | 'FIND_LUXURY_LEADS'
  | 'FIND_PHARMA_LEADS'
  | 'FIND_MEDTECH_LEADS'
  | 'FIND_TIMEPIECE_LEADS'
  | 'MONITOR_NEWS_FOR_PR'
  | 'DRAFT_OUTBOUND_EMAIL'
  | 'BUILD_PILOT_PACKET'
  | 'DRAFT_INTEL_DOSSIER'
  | 'FOLLOWUP_SEQUENCE'
  | 'CRM_UPDATE'
  | 'FINALIZE_RETAIL_SIGNAGE'
  | 'PACKAGE_SKU_ONBOARDING'
  | 'CHECK_DNS_CONFIG'
  | 'VERIFY_SSL'
  | 'RUN_LIGHTHOUSE_AUDIT'
  | 'GENERATE_LAUNCH_CHECKLIST'
  | 'DRAFT_LAUNCH_EMAIL'
  | 'DRAFT_PRESS_RELEASE'
  | 'SCHEDULE_SOCIAL_POSTS'
  | 'CHECK_REPLIES'
  | 'SEND_DEMO_PACKET'
  | 'GENERATE_PROPOSAL'
  | 'SEND_CONTRACT'
  | 'AUTO_REPLY'
  | 'GENERATE_OUTREACH_VIDEO'
  | 'SECURITY_AUDIT'
  // ── Dev Team ──────────────────────────────────────────────
  | 'PLAN_SPRINT'
  | 'WRITE_CODE'
  | 'OPEN_PR'
  | 'RUN_TESTS'
  | 'CODE_REVIEW'
  | 'MERGE_PR'
  | 'MONITOR_DEPLOY'
  | 'FILE_BUG'
  | 'AUTO_FIX';

export type LeadSegment = 'GOV' | 'RETAIL' | 'PRESS';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING_SCHEDULED'
  | 'PILOT_PROPOSED'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

// ─── Repository contract ──────────────────────────────────────────────────────
// Implemented by DbMissionsRepository (real DB) and injectable for tests.
export interface IMissionsRepository {
  getMissions(status?: MissionStatus): Promise<any[]>;
  getMissionById(id: string): Promise<any | null>;
  createMission(type: MissionType): Promise<string>;
  updateMissionStatus(id: string, status: MissionStatus): Promise<void>;
  getTasksByMission(missionId: string): Promise<any[]>;
  retryTask(id: string): Promise<void>;
}
