import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { logActivity, getDueTasks, getRunTaskCount, getAdaptivePriors, createMission, getActiveMissionTypes, type Db } from "./db-helpers";
import { runBudgetMonitor } from "./budget-monitor";
import { runDunningEscalation } from "./dunning";
import { runRetentionAutomation } from "./retention";
import { runWeeklyDigestDispatch } from "./weekly-digest";
import { runQuarterlyValueReportDispatch } from "./quarterly-value";
import { runOrganicTrafficAutomation } from "./organic-traffic";
import { runBrowserAgentJobs } from "./browser-jobs";
import { runTask } from "./task-runner";
import { ucb1Score, betaMean } from "../_core/bayesian";

export async function runPipelineTick(db: Db, options?: { force?: boolean }) {
  if (!ENV.autonomousPipelineEnabled && !options?.force) {
    return { enabled: false, skipped: true, reason: "AUTONOMOUS_PIPELINE_ENABLED=false" };
  }

  const budgetMonitor = await runBudgetMonitor(db);
  const dunning = await runDunningEscalation(db);
  const retention = await runRetentionAutomation(db);
  const weeklyDigest = await runWeeklyDigestDispatch(db);
  const quarterlyValue = await runQuarterlyValueReportDispatch(db);
  const organicTraffic = await runOrganicTrafficAutomation(db);
  const browserJobs = await runBrowserAgentJobs(db);

  // Mission task orchestration — UCB1 prioritisation
  // Score each task's kind by: E[conversion] + exploration bonus.
  // Unexplored task kinds get Infinity (always tried first).
  const [dueTasks, runCount, adaptivePriors] = await Promise.all([
    getDueTasks(db),
    getRunTaskCount(db),
    getAdaptivePriors(db),
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
    const seg = kindToSegment[task.kind ?? ''] ?? 'DEFAULT';
    const prior = adaptivePriors[seg] ?? adaptivePriors.DEFAULT;
    return { task, score: ucb1Score(prior, totalTasks) };
  });

  scored.sort((a, b) => b.score - a.score);

  const taskResults = { total: dueTasks.length, ran: 0, errors: 0 };
  for (const { task } of scored) {
    const result = await runTask(db, task);
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
  const activeMissionTypes = await getActiveMissionTypes(db);
  const pmfCreated: string[] = [];
  for (const [seg, { missionType, threshold }] of Object.entries(PMF_THRESHOLDS)) {
    const prior = adaptivePriors[seg];
    if (!prior) continue;
    const mean = betaMean(prior);
    if (mean >= threshold && !activeMissionTypes.includes(missionType)) {
      await createMission(db, missionType as any);
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

  await logActivity(db, {
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
  // Documented bridge: standalone CLI entry point has no caller to thread a
  // db instance from, so it obtains one from the legacy Node singleton itself.
  getDb()
    .then(db => runPipelineTick(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Pipeline tick failed:", err);
      process.exit(1);
    });
}
