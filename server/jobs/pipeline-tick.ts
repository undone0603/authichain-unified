import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ENV } from "../_core/env";
import { withDryRunEmail } from "../email-service";
import { logActivity } from "../db";
import { runBudgetMonitor } from "./budget-monitor";
import { runDunningEscalation } from "./dunning";
import { runRetentionAutomation } from "./retention";
import { runWeeklyDigestDispatch } from "./weekly-digest";
import { runQuarterlyValueReportDispatch } from "./quarterly-value";
import { runOrganicTrafficAutomation } from "./organic-traffic";
import { runBrowserAgentJobs } from "./browser-jobs";
import { getDueTasks, getRunTaskCount, getAdaptivePriors, createMission, getActiveMissionTypes } from "../db";
import { runTask } from "./task-runner";
import { ucb1Score, betaMean } from "../_core/bayesian";

/**
 * Runs one pipeline tick.
 *
 * `dryRun` answers "what would a live tick actually do?" without sending mail.
 * Until it existed the only way to find out was to read the call graph by
 * hand — seven subsystems deep — which is a poor thing to rely on immediately
 * before switching on something that emails people.
 *
 * ── What dryRun does and does not cover ──────────────────────────────────────
 * Covered: every outbound email. sendEmail() records the message and returns
 * without contacting a provider, so this holds for send sites that do not know
 * the dry run exists.
 *
 * NOT covered, and this matters: the tick still runs for real otherwise. It
 * writes to the database, creates missions, executes due tasks, and any
 * non-email outward action a task takes — an HTTP call, a social post — still
 * happens. This is deliberate, because a run that skipped all of that would
 * not tell you what a live run does. It is not a no-op, and it is not a
 * transaction that rolls back. Treat it as "live, minus the mail".
 */
export async function runPipelineTick(options?: { force?: boolean; dryRun?: boolean }) {
  if (options?.dryRun) {
    // dryRun implies force: the point is to see what a live tick would do
    // while the switch is still off, which is when the question gets asked.
    const { result, sends } = await withDryRunEmail(executeTick);
    return {
      ...result,
      dryRun: {
        emails: "recorded, not sent",
        database: "written for real",
        otherChannels: "live — non-email actions were not intercepted",
      },
      wouldHaveEmailed: sends.map(s => ({ to: s.to, subject: s.subject, preview: s.body.slice(0, 160) })),
    };
  }

  if (!ENV.autonomousPipelineEnabled && !options?.force) {
    return { enabled: false as const, skipped: true as const, reason: "AUTONOMOUS_PIPELINE_ENABLED=false" };
  }

  return executeTick();
}

/** The tick itself. Split out so the dry-run wrapper does not have to call
 *  runPipelineTick recursively, which left its return type uninferable. */
async function executeTick() {
  const budgetMonitor = await runBudgetMonitor();
  const dunning = await runDunningEscalation();
  const retention = await runRetentionAutomation();
  const weeklyDigest = await runWeeklyDigestDispatch();
  const quarterlyValue = await runQuarterlyValueReportDispatch();
  const organicTraffic = await runOrganicTrafficAutomation();
  const browserJobs = await runBrowserAgentJobs();

  // Mission task orchestration — UCB1 prioritisation
  // Score each task's kind by: E[conversion] + exploration bonus.
  // Unexplored task kinds get Infinity (always tried first).
  const [dueTasks, runCount, adaptivePriors] = await Promise.all([
    getDueTasks(),
    getRunTaskCount(),
    getAdaptivePriors(),
  ]);
  // totalTasks must reflect cumulative history — using only the current batch would
  // make the exploration bonus a constant (ln(batchSize)) rather than growing with experience.
  const totalTasks = Math.max(runCount, 1);

  const kindToSegment: Record<string, string> = {
    FIND_GOV_LEADS:              'GOV',
    FIND_RETAIL_LEADS:           'RETAIL',
    FIND_LUXURY_LEADS:           'LUXURY',
    FIND_PHARMA_LEADS:           'PHARMA',
    FIND_TIMEPIECE_LEADS:        'TIMEPIECE',
    DRAFT_OUTBOUND_EMAIL:        'GOV',
    FOLLOWUP_SEQUENCE:           'GOV',
    BUILD_PILOT_PACKET:          'PARTNER',
    DRAFT_INTEL_DOSSIER:         'PRESS',
    CRM_UPDATE:                  'PARTNER',
    DRAFT_PRESS_RELEASE:         'PRESS',
    // Browser agent tasks inherit segment from the lead they serve
    BROWSE_RESEARCH_LEAD:        'DEFAULT',
    BROWSE_COMPETITOR_MONITOR:   'DEFAULT',
    BROWSE_SCRAPE_INDUSTRY_NEWS: 'DEFAULT',
    BROWSE_VERIFY_PRODUCT_URL:     'DEFAULT',
    BROWSE_VISION_RESEARCH_LEAD:   'DEFAULT',
    BROWSE_VISION_FREEFORM:        'DEFAULT',
  };

  const scored = dueTasks.map(task => {
    const seg = kindToSegment[task.kind] ?? 'DEFAULT';
    const prior = adaptivePriors[seg] ?? adaptivePriors.DEFAULT;
    return { task, score: ucb1Score(prior, totalTasks) };
  });

  scored.sort((a, b) => b.score - a.score);

  const taskResults = { total: dueTasks.length, ran: 0, errors: 0 };
  for (const { task } of scored) {
    const result = await runTask(task);
    if (result.ok) {
      taskResults.ran++;
    } else {
      taskResults.errors++;
    }
  }

  // ── PMF auto-scale: if a segment's posterior mean exceeds threshold AND
  //    no active mission of that type exists, create one automatically. ──────
  const PMF_THRESHOLDS: Record<string, { missionType: string; threshold: number }> = {
    GOV:    { missionType: 'GOV_PILOT',    threshold: 0.12 },
    RETAIL: { missionType: 'RETAIL_PILOT', threshold: 0.10 },
  };
  const activeMissionTypes = await getActiveMissionTypes();
  const pmfCreated: string[] = [];
  for (const [seg, { missionType, threshold }] of Object.entries(PMF_THRESHOLDS)) {
    const prior = adaptivePriors[seg];
    if (!prior) continue;
    const mean = betaMean(prior);
    if (mean >= threshold && !activeMissionTypes.includes(missionType)) {
      await createMission(missionType as any);
      pmfCreated.push(missionType);
    }
  }

  const summary = {
    enabled: true,
    budgetMonitor,
    dunning,
    retention,
    weeklyDigest,
    quarterlyValue,
    organicTraffic,
    browserJobs,
    missionTasks: taskResults,
    pmfCreated,
  };

  await logActivity({
    userId: null,
    action: "pipeline_tick_executed",
    entityType: "automation",
    entityId: 0,
    details: summary,
  });

  return summary;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // `pnpm tsx server/jobs/pipeline-tick.ts --dry-run` reports what a live tick
  // would do, including while AUTONOMOUS_PIPELINE_ENABLED is unset.
  runPipelineTick({ dryRun: process.argv.includes("--dry-run") })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Pipeline tick failed:", err);
      process.exit(1);
    });
}
