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
import { withRetry } from "../_core/retry";
import { getCircuitBreaker } from "../_core/circuit-breaker";

async function safeRun<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const cb = getCircuitBreaker(name, { failureThreshold: 3, timeoutMs: 5 * 60_000 });
  try {
    return await cb.exec(() => withRetry(fn, { maxAttempts: 2, baseDelayMs: 1000 }));
  } catch (err) {
    console.warn(`[pipeline-tick] ${name} failed:`, err);
    return null;
  }
}

export async function runPipelineTick() {
  if (!ENV.autonomousPipelineEnabled) {
    return { enabled: false, skipped: true, reason: "AUTONOMOUS_PIPELINE_ENABLED=false" };
  }

  const [budgetMonitor, dunning, retention, weeklyDigest, quarterlyValue, organicTraffic] =
    await Promise.all([
      safeRun("budgetMonitor",   runBudgetMonitor),
      safeRun("dunning",         runDunningEscalation),
      safeRun("retention",       runRetentionAutomation),
      safeRun("weeklyDigest",    runWeeklyDigestDispatch),
      safeRun("quarterlyValue",  runQuarterlyValueReportDispatch),
      safeRun("organicTraffic",  runOrganicTrafficAutomation),
    ]);

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
    FIND_GOV_LEADS:       'GOV',
    FIND_RETAIL_LEADS:    'RETAIL',
    DRAFT_OUTBOUND_EMAIL: 'GOV',
    FOLLOWUP_SEQUENCE:    'GOV',
    BUILD_PILOT_PACKET:   'PARTNER',
    DRAFT_INTEL_DOSSIER:  'PRESS',
    CRM_UPDATE:           'PARTNER',
    DRAFT_PRESS_RELEASE:  'PRESS',
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
