import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ENV } from "../_core/env";
import { logActivity, getDb } from "../db";
import { missions, missionTasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { runBudgetMonitor } from "./budget-monitor";
import { runDunningEscalation } from "./dunning";
import { runRetentionAutomation } from "./retention";
import { runWeeklyDigestDispatch } from "./weekly-digest";
import { runQuarterlyValueReportDispatch } from "./quarterly-value";
import { runOrganicTrafficAutomation } from "./organic-traffic";
import { getDueTasks, getRunTaskCount, getAdaptivePriors, createMission, getActiveMissionTypes } from "../db";
import { runTask } from "./task-runner";
import { ucb1Score, betaMean } from "../_core/bayesian";
import { triggerHumanHandshake } from "../sms-handshake";

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
    FIND_GOV_LEADS:       'GOV',
    FIND_RETAIL_LEADS:    'RETAIL',
    DRAFT_OUTBOUND_EMAIL: 'GOV',
    FOLLOWUP_SEQUENCE:    'GOV',
    BUILD_PILOT_PACKET:   'PARTNER',
    DRAFT_INTEL_DOSSIER:  'PRESS',
    CRM_UPDATE:           'PARTNER',
    DRAFT_PRESS_RELEASE:  'PRESS',
    SEND_CONTRACT:        'HIGH_INTENT',
    GENERATE_PROPOSAL:    'HIGH_INTENT',
    CHECK_REPLIES:        'HIGH_INTENT',
  };

  const scored = dueTasks.map(task => {
    const kind = (task as any).kind ?? '';
    const seg = kindToSegment[kind] ?? 'DEFAULT';
    const prior = (adaptivePriors as any)[seg] ?? (adaptivePriors as any).DEFAULT ?? { alpha: 1, beta: 1 };
    
    let score = ucb1Score(prior, totalTasks);
    
    // Revenue Acceleration Hack: Multiplier for closing tasks
    if (seg === 'HIGH_INTENT') score *= 2.5;
    
    return { task, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const taskResults = { total: dueTasks.length, ran: 0, errors: 0 };
  for (const { task, score } of scored) {
    const result = await runTask(task);
    if (result.ok) {
      taskResults.ran++;
      
      // Executive Action: Human Handshake SMS Bypass
      if ((task as any).kind === 'SEND_CONTRACT' || (task as any).kind === 'GENERATE_PROPOSAL') {
        const payload = (task as any).payload || {};
        await triggerHumanHandshake({
          name: payload.prospectName || "High-Intent Lead",
          company: payload.prospectCompany || "Enterprise Prospect",
          email: payload.prospectEmail || "N/A",
          phone: payload.prospectPhone || "",
          context: `Autonomous agent successfully executed ${task.kind}. Outreach dispatched automatically. Immediate handshake recommended.`
        });
      }
    } else {
      taskResults.errors++;
    }
  }

  // ── Executive Action: High-Value Blitz ────────────────────────────────────
  // If conversion mean is high, force create new tasks immediately to keep momentum
  const blitzCreated: string[] = [];
  for (const [seg, prior] of Object.entries(adaptivePriors as any)) {
    if (seg === 'DEFAULT') continue;
    const mean = betaMean(prior as any);
    if (mean > 0.15) {
      console.log(`[Pipeline] Blitz triggered for ${seg} (Mean: ${mean.toFixed(2)})`);

      try {
        // Spawn high-velocity tasks for the winning segment
        const blitzDb = await getDb();
        const blitzMissions = await blitzDb.select().from(missions).where(eq(missions.status, "ACTIVE")).limit(5);
        for (const m of blitzMissions) {
          await blitzDb.insert(missionTasks).values({
            id: crypto.randomUUID(),
            missionId: m.id,
            title: `Blitz: ${seg} Lead Generation`,
            description: `Auto-generated blitz task for ${seg} segment`,
            kind: seg === 'GOV' ? 'FIND_GOV_LEADS' : 'FIND_RETAIL_LEADS',
            status: 'pending',
            order: 0,
            payload: { blitz: true, timestamp: new Date().toISOString() }
          });
          blitzCreated.push(`${seg}:${m.id}`);
        }
      } catch (err) {
        console.error(`[Pipeline] Blitz DB operation failed for ${seg}:`, err);
      }
    }
  }

  // ── PMF auto-scale: if a segment's posterior mean exceeds threshold AND
  //    no active mission of that type exists, create one automatically. ──────
  const PMF_THRESHOLDS: Record<string, { missionType: string; threshold: number }> = {
    GOV:    { missionType: 'GOV_PILOT',    threshold: 0.05 }, // Aggressive: Was 0.12
    RETAIL: { missionType: 'RETAIL_PILOT', threshold: 0.04 }, // Aggressive: Was 0.10
    LUXURY: { missionType: 'LUXURY_BLITZ', threshold: 0.03 }, // New: Aggressive expansion
    PHARMA: { missionType: 'PHARMA_AUDIT', threshold: 0.03 }, // New: Aggressive expansion
  };
  const activeMissionTypes = await getActiveMissionTypes();
  const pmfCreated: string[] = [];
  for (const [seg, { missionType, threshold }] of Object.entries(PMF_THRESHOLDS)) {
    const prior = (adaptivePriors as any)[seg];
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
