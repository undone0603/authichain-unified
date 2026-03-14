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
import {
  runCheckReplies,
  runSendDemoPacket,
  runGenerateProposal,
  runSendContract,
  runAutoReply,
} from '../agents/closer.js';
import { runGenerateOutreachVideo } from '../agents/heygen-video.js';
import { runPlanSprint, runWriteCode } from '../agents/dev-team/code-writer.js';
import { runOpenPR, runCodeReview, runMergePR } from '../agents/dev-team/pr-manager.js';
import { runTests, runMonitorDeploy, runFileBug, runAutoFix } from '../agents/dev-team/test-runner.js';

export async function runTask(task: Task): Promise<{ ok: boolean }> {
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

      case 'CHECK_REPLIES':
        await runCheckReplies(task);
        break;

      case 'SEND_DEMO_PACKET':
        await runSendDemoPacket(task);
        break;

      case 'GENERATE_PROPOSAL':
        await runGenerateProposal(task);
        break;

      case 'SEND_CONTRACT':
        await runSendContract(task);
        break;

      case 'AUTO_REPLY':
        await runAutoReply(task);
        break;

      case 'GENERATE_OUTREACH_VIDEO':
        await runGenerateOutreachVideo(task);
        break;

      // ── Dev Team ────────────────────────────────────────────────────────
      case 'PLAN_SPRINT':
        await runPlanSprint(task);
        break;

      case 'WRITE_CODE':
        await runWriteCode(task);
        break;

      case 'OPEN_PR':
        await runOpenPR(task);
        break;

      case 'RUN_TESTS':
        await runTests(task);
        break;

      case 'CODE_REVIEW':
        await runCodeReview(task);
        break;

      case 'MERGE_PR':
        await runMergePR(task);
        break;

      case 'MONITOR_DEPLOY':
        await runMonitorDeploy(task);
        break;

      case 'FILE_BUG':
        await runFileBug(task);
        break;

      case 'AUTO_FIX':
        await runAutoFix(task);
        break;

      default:
        throw new Error(`Unknown task kind: ${task.kind}`);
    }

    // markTaskDone guards with WHERE status='RUNNING', so WAITING_HUMAN is preserved if the agent set it
    await markTaskDone(task.id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markTaskFailed(task.id, message);
    await logActivity({ userId: null, action: 'task_failed', entityType: 'task', entityId: 0, details: { taskId: task.id,
      kind: task.kind,
      missionId: task.missionId,
      error: message,
    }});
    return { ok: false };
  }
}
