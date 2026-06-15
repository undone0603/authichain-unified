import { markTaskRunning, markTaskDone, markTaskFailed, logActivity } from '../db';
import type { MissionTask as Task } from '../../drizzle/schema';
import { runLeadFinder } from '../agents/lead-finder';
import { runOutboundEmail } from '../agents/outbound-email';
import { runFollowupSequence } from '../agents/followup';
import { runBuildPilotPacket, runDraftIntelDossier } from '../agents/pilot-packet';
import { runCrmUpdate } from '../agents/crm-update';
import { runFinalizeRetailSignage, runPackageSkuOnboarding } from '../agents/retail';
import { runCheckDnsConfig, runVerifySsl, runLighthouseAudit } from '../agents/infra';
import {
  runGenerateLaunchChecklist,
  runDraftLaunchEmail,
  runDraftPressRelease,
  runScheduleSocialPosts,
} from '../agents/content';
import {
  runCheckReplies,
  runSendDemoPacket,
  runGenerateProposal,
  runSendContract,
  runAutoReply,
<<<<<<< HEAD
} from '../agents/closer.js';
import { runPitchMoonshotDeal, runMoonshotProposal } from '../agents/moonshot.js';
import { runGenerateOutreachVideo } from '../agents/heygen-video.js';
import { runSecurityAudit } from '../agents/security.js';
import { runNewsjackingMonitor } from '../agents/news-pr.js';
import { runPlanSprint, runWriteCode } from '../agents/dev-team/code-writer.js';
import { runOpenPR, runCodeReview, runMergePR } from '../agents/dev-team/pr-manager.js';
import { runTests, runMonitorDeploy, runFileBug, runAutoFix } from '../agents/dev-team/test-runner.js';
=======
} from '../agents/closer';
import { runGenerateOutreachVideo } from '../agents/heygen-video';
import { runSecurityAudit } from '../agents/security';
import { runNewsjackingMonitor } from '../agents/news-pr';
import {
  runBrowseResearchLead,
  runBrowseCompetitorMonitor,
  runBrowseScrapeIndustryNews,
  runBrowseVerifyProductUrl,
} from '../agents/browser';
import { runVisionResearchLead, runVisionFreeform } from '../agents/browser-vision';
import { runPlanSprint, runWriteCode } from '../agents/dev-team/code-writer';
import { runOpenPR, runCodeReview, runMergePR } from '../agents/dev-team/pr-manager';
import { runTests, runMonitorDeploy, runFileBug, runAutoFix } from '../agents/dev-team/test-runner';
>>>>>>> origin/add-agentz-editable

export async function runTask(task: Task): Promise<{ ok: boolean }> {
  const claimed = await markTaskRunning(task.id);
  if (!claimed) return { ok: true }; // Another worker already claimed this task

  try {
    switch (task.kind) {
      case 'FIND_GOV_LEADS':
      case 'FIND_RETAIL_LEADS':
      case 'FIND_LUXURY_LEADS':
      case 'FIND_PHARMA_LEADS':
      case 'FIND_TIMEPIECE_LEADS':
      case 'FIND_ENTERTAINMENT_LEADS':
      case 'FIND_SPORTS_LEADS':
      case 'FIND_CREATOR_LEADS':
      case 'FIND_COLLECTIBLES_LEADS':
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

      case 'PITCH_MOONSHOT_DEAL':
        await runPitchMoonshotDeal(task);
        break;

      case 'MOONSHOT_PROPOSAL':
        await runMoonshotProposal(task);
        break;

      case 'GENERATE_OUTREACH_VIDEO':
        await runGenerateOutreachVideo(task);
        break;

      case 'SECURITY_AUDIT':
        await runSecurityAudit(task);
        break;

      case 'MONITOR_NEWS_FOR_PR':
        await runNewsjackingMonitor(task);
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

      // ── Browser Agent ────────────────────────────────────────────────────
      case 'BROWSE_RESEARCH_LEAD':
        await runBrowseResearchLead(task);
        break;

      case 'BROWSE_COMPETITOR_MONITOR':
        await runBrowseCompetitorMonitor(task);
        break;

      case 'BROWSE_SCRAPE_INDUSTRY_NEWS':
        await runBrowseScrapeIndustryNews(task);
        break;

      case 'BROWSE_VERIFY_PRODUCT_URL':
        await runBrowseVerifyProductUrl(task);
        break;

      // ── Browser Vision Agent (Playwright + Gemini vision) ────────────────
      case 'BROWSE_VISION_RESEARCH_LEAD':
        await runVisionResearchLead(task);
        break;

      case 'BROWSE_VISION_FREEFORM':
        await runVisionFreeform(task);
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
