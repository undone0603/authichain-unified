import { markTaskRunning, markTaskDone, markTaskFailed, logActivity, getDb } from '../db.js';
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
import { runSecurityAudit } from '../agents/security.js';
import { runNewsjackingMonitor } from '../agents/news-pr.js';
import {
  runBrowseResearchLead,
  runBrowseCompetitorMonitor,
  runBrowseScrapeIndustryNews,
  runBrowseVerifyProductUrl,
} from '../agents/browser.js';
// browser-vision (Playwright) is imported lazily inside runTask: Playwright
// cannot load in the Workers runtime, so vision tasks are left pending there
// and processed by the browser-vision-tasks GitHub Actions runner instead.
import { runPlanSprint, runWriteCode } from '../agents/dev-team/code-writer.js';
import { runOpenPR, runCodeReview, runMergePR } from '../agents/dev-team/pr-manager.js';
import { runTests, runMonitorDeploy, runFileBug, runAutoFix } from '../agents/dev-team/test-runner.js';

const VISION_TASK_KINDS = new Set(['BROWSE_VISION_RESEARCH_LEAD', 'BROWSE_VISION_FREEFORM']);

export async function runTask(task: Task): Promise<{ ok: boolean }> {
  // Vision tasks need a Playwright-capable Node host. Leave them unclaimed
  // (still PENDING) unless this process declares Playwright available — the
  // browser-vision-tasks workflow sets PLAYWRIGHT_AVAILABLE=1.
  if (VISION_TASK_KINDS.has(task.kind ?? '') && process.env.PLAYWRIGHT_AVAILABLE !== '1') {
    return { ok: true };
  }

  const claimed = await markTaskRunning(task.id);
  if (!claimed) return { ok: true }; // Another worker already claimed this task

  // TODO(2b-2): task-runner.ts itself still bridges via the legacy Node
  // singleton getDb() rather than receiving a threaded db param — this file
  // is server/jobs/** (Task 2b-2's scope). It obtains db here and threads
  // it into every server/agents/** function it calls (Task 2b-1's scope,
  // already migrated off the singleton) so the agents themselves have no
  // remaining direct db.ts coupling.
  const db = await getDb();

  try {
    switch (task.kind) {
      case 'FIND_GOV_LEADS':
      case 'FIND_RETAIL_LEADS':
      case 'FIND_LUXURY_LEADS':
      case 'FIND_PHARMA_LEADS':
      case 'FIND_TIMEPIECE_LEADS':
        await runLeadFinder(task, db);
        break;

      case 'DRAFT_OUTBOUND_EMAIL':
        await runOutboundEmail(task, db);
        break;

      case 'FOLLOWUP_SEQUENCE':
        await runFollowupSequence(task, db);
        break;

      case 'BUILD_PILOT_PACKET':
        await runBuildPilotPacket(task, db);
        break;

      case 'DRAFT_INTEL_DOSSIER':
        await runDraftIntelDossier(task, db);
        break;

      case 'CRM_UPDATE':
        await runCrmUpdate(task, db);
        break;

      case 'FINALIZE_RETAIL_SIGNAGE':
        await runFinalizeRetailSignage(task, db);
        break;

      case 'PACKAGE_SKU_ONBOARDING':
        await runPackageSkuOnboarding(task, db);
        break;

      case 'CHECK_DNS_CONFIG':
        await runCheckDnsConfig(task, db);
        break;

      case 'VERIFY_SSL':
        await runVerifySsl(task, db);
        break;

      case 'RUN_LIGHTHOUSE_AUDIT':
        await runLighthouseAudit(task, db);
        break;

      case 'GENERATE_LAUNCH_CHECKLIST':
        await runGenerateLaunchChecklist(task, db);
        break;

      case 'DRAFT_LAUNCH_EMAIL':
        await runDraftLaunchEmail(task, db);
        break;

      case 'DRAFT_PRESS_RELEASE':
        await runDraftPressRelease(task, db);
        break;

      case 'SCHEDULE_SOCIAL_POSTS':
        await runScheduleSocialPosts(task, db);
        break;

      case 'CHECK_REPLIES':
        await runCheckReplies(task, db);
        break;

      case 'SEND_DEMO_PACKET':
        await runSendDemoPacket(task, db);
        break;

      case 'GENERATE_PROPOSAL':
        await runGenerateProposal(task, db);
        break;

      case 'SEND_CONTRACT':
        await runSendContract(task, db);
        break;

      case 'AUTO_REPLY':
        await runAutoReply(task, db);
        break;

      case 'GENERATE_OUTREACH_VIDEO':
        await runGenerateOutreachVideo(task, db);
        break;

      case 'SECURITY_AUDIT':
        await runSecurityAudit(task, db);
        break;

      case 'MONITOR_NEWS_FOR_PR':
        await runNewsjackingMonitor(task, db);
        break;

      // ── Dev Team ────────────────────────────────────────────────────────
      case 'PLAN_SPRINT':
        await runPlanSprint(task, db);
        break;

      case 'WRITE_CODE':
        await runWriteCode(task, db);
        break;

      case 'OPEN_PR':
        await runOpenPR(task, db);
        break;

      case 'RUN_TESTS':
        await runTests(task, db);
        break;

      case 'CODE_REVIEW':
        await runCodeReview(task, db);
        break;

      case 'MERGE_PR':
        await runMergePR(task, db);
        break;

      case 'MONITOR_DEPLOY':
        await runMonitorDeploy(task, db);
        break;

      case 'FILE_BUG':
        await runFileBug(task, db);
        break;

      case 'AUTO_FIX':
        await runAutoFix(task, db);
        break;

      // ── Browser Agent ────────────────────────────────────────────────────
      case 'BROWSE_RESEARCH_LEAD':
        await runBrowseResearchLead(task, db);
        break;

      case 'BROWSE_COMPETITOR_MONITOR':
        await runBrowseCompetitorMonitor(task, db);
        break;

      case 'BROWSE_SCRAPE_INDUSTRY_NEWS':
        await runBrowseScrapeIndustryNews(task, db);
        break;

      case 'BROWSE_VERIFY_PRODUCT_URL':
        await runBrowseVerifyProductUrl(task, db);
        break;

      // ── Browser Vision Agent (Playwright + Gemini vision) ────────────────
      // Never reached here: the PLAYWRIGHT_AVAILABLE gate above leaves vision
      // tasks pending, and scripts/run-vision-tasks.ts (the Playwright-capable
      // GitHub Actions runner) executes them without going through this
      // switch. Importing browser-vision here would drag playwright-core into
      // the Workers bundle and break the build.
      case 'BROWSE_VISION_RESEARCH_LEAD':
      case 'BROWSE_VISION_FREEFORM':
        throw new Error(`${task.kind} must run via scripts/run-vision-tasks.ts (Playwright runner)`);

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
