import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ENV } from "../_core/env";
import { logActivity } from "../db";
import { runBudgetMonitor } from "./budget-monitor";
import { runDunningEscalation } from "./dunning";
import { runRetentionAutomation } from "./retention";
import { runWeeklyDigestDispatch } from "./weekly-digest";
import { runQuarterlyValueReportDispatch } from "./quarterly-value";
import { runOrganicTrafficAutomation } from "./organic-traffic";
import { getDueTasks, getRunTaskCount, getAdaptivePriors, createMission, getActiveMissionTypes } from "../db";
import { runTask } from "./task-runner";
import { ucb1Score, betaMean } from "../_core/bayesian";

export async function runPipelineTick() {
  if (!ENV.autonomousPipelineEnabled) {
    return { enabled: false, skipped: true, reason: "AUTONOMOUS_PIPELINE_ENABLED=false" };
  }

  const budgetMonitor = await runBudgetMonitor();
  const dunning = await runDunningEscalation();
  const retention = await runRetentionAutomation();
  const weeklyDigest = await runWeeklyDigestDispatch();
  const quarterlyValue = await runQuarterlyValueReportDispatch();
  const organicTraffic = await runOrganicTrafficAutomation();

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
    FIND_GOV_LEADS:          'GOV',
    FIND_RETAIL_LEADS:       'RETAIL',
    FIND_CANNABIS_LEADS:     'CANNABIS',
    DRAFT_OUTBOUND_EMAIL:    'GOV',
    DRAFT_CANNABIS_OUTREACH: 'CANNABIS',
    FOLLOWUP_SEQUENCE:       'GOV',
    BUILD_PILOT_PACKET:      'PARTNER',
    DRAFT_INTEL_DOSSIER:     'PRESS',
    CRM_UPDATE:              'PARTNER',
    DRAFT_PRESS_RELEASE:     'PRESS',
    SEND_CONTRACT:           'HIGH_INTENT',
    GENERATE_PROPOSAL:       'HIGH_INTENT',
    CHECK_REPLIES:           'HIGH_INTENT',
    ANCHOR_METRC_PACKAGE:    'CANNABIS',
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
    GOV:      { missionType: 'GOV_PILOT',        threshold: 0.05 },
    RETAIL:   { missionType: 'RETAIL_PILOT',      threshold: 0.04 },
    LUXURY:   { missionType: 'LUXURY_BLITZ',      threshold: 0.03 },
    PHARMA:   { missionType: 'PHARMA_AUDIT',      threshold: 0.03 },
    // Cannabis is the warmest vertical — 9+ named chains in HubSpot pipeline.
    // Low threshold so missions auto-spawn as soon as any prior data exists.
    CANNABIS: { missionType: 'STRAINCHAIN_BLITZ', threshold: 0.02 },
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
  runPipelineTick()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Pipeline tick failed:", err);
      process.exit(1);
    });
}
