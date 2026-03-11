import { markTaskRunning, markTaskDone, markTaskFailed, logActivity } from '../db.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';
import { runLeadFinder } from '../agents/lead-finder.js';
import { runOutboundEmail } from '../agents/outbound-email.js';
import { runFollowupSequence } from '../agents/followup.js';
import { runBuildPilotPacket, runDraftIntelDossier } from '../agents/pilot-packet.js';
import { runCrmUpdate } from '../agents/crm-update.js';
import { runFinalizeRetailSignage, runPackageSkuOnboarding } from '../agents/retail.js';
import { runCheckDnsConfig, runVerifySsl, runLighthouseAudit } from '../agents/infra.js';
import {
  runGenerateLaunchChecklist,
  runDraftLaunchEmail,
  runDraftPressRelease,
  runScheduleSocialPosts,
} from '../agents/content.js';

export async function runTask(task: Task): Promise<void> {
  await markTaskRunning(task.id);

  try {
    switch (task.kind) {
      case 'FIND_GOV_LEADS':
      case 'FIND_RETAIL_LEADS':
        await runLeadFinder(task);
        break;

      case 'DRAFT_OUTBOUND_EMAIL':
        await runOutboundEmail(task);
        break;

      case 'FOLLOWUP_SEQUENCE':
        await runFollowupSequence(task);
        break;

      case 'BUILD_PILOT_PACKET':
        await runBuildPilotPacket(task);
        break;

      case 'DRAFT_INTEL_DOSSIER':
        await runDraftIntelDossier(task);
        break;

      case 'CRM_UPDATE':
        await runCrmUpdate(task);
        break;

      case 'FINALIZE_RETAIL_SIGNAGE':
        await runFinalizeRetailSignage(task);
        break;

      case 'PACKAGE_SKU_ONBOARDING':
        await runPackageSkuOnboarding(task);
        break;

      case 'CHECK_DNS_CONFIG':
        await runCheckDnsConfig(task);
        break;

      case 'VERIFY_SSL':
        await runVerifySsl(task);
        break;

      case 'RUN_LIGHTHOUSE_AUDIT':
        await runLighthouseAudit(task);
        break;

      case 'GENERATE_LAUNCH_CHECKLIST':
        await runGenerateLaunchChecklist(task);
        break;

      case 'DRAFT_LAUNCH_EMAIL':
        await runDraftLaunchEmail(task);
        break;

      case 'DRAFT_PRESS_RELEASE':
        await runDraftPressRelease(task);
        break;

      case 'SCHEDULE_SOCIAL_POSTS':
        await runScheduleSocialPosts(task);
        break;

      default:
        throw new Error(`Unknown task kind: ${task.kind}`);
    }

    // Agents that set WAITING_HUMAN skip markTaskDone — check current status
    await markTaskDone(task.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markTaskFailed(task.id, message);
    await logActivity({ userId: null, action: 'task_failed', entityType: 'task', entityId: 0, details: { taskId: task.id,
      kind: task.kind,
      missionId: task.missionId,
      error: message,
    }});
  }
}
