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
import { getDueTasks } from "../db";
import { runTask } from "./task-runner";

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

  // Mission task orchestration
  const dueTasks = await getDueTasks();
  const taskResults = { total: dueTasks.length, ran: 0, errors: 0 };
  for (const task of dueTasks) {
    try {
      await runTask(task);
      taskResults.ran++;
    } catch {
      taskResults.errors++;
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
