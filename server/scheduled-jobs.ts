import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// server/scheduled-jobs.ts
import { getDb } from "./db";
import { scheduledJobRuns, subscriptions, certificates, leads, notifications, users, authentications, payments, revenueRecords, customerHealthScores, fraudAlerts, stakingPositions, qronRewardLedger, emailDrafts } from "../drizzle/schema";
import { eq, lt, and, sql, desc, isNull, lte, gte, count } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { isHubSpotConfigured, syncLeadToHubSpot, getCRMStats } from "./hubspot-service";
import { ENV } from "./_core/env";
import { runStrainChainSync } from "./jobs/strainchain-sync";

// ─── Job Registry ───────────────────────────────────────────────────────────
interface JobDefinition {
  name: string;
  description: string;
  schedule: string; // cron expression
  enabled: boolean;
  handler: () => Promise<JobResult>;
}

interface JobResult {
  itemsProcessed: number;
  details: Record<string, any>;
}

const jobs: JobDefinition[] = [];
const scheduledTasks: Map<string, any> = new Map();

function registerJob(job: JobDefinition) {
  jobs.push(job);
}

// ─── Job Execution Wrapper ──────────────────────────────────────────────────
export async function executeJob(job: JobDefinition): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn(`[Scheduler] Skipping ${job.name}: database not available`);
    return;
  }

  const startTime = Date.now();
  console.log(`[Scheduler] Starting job: ${job.name}`);

  // Insert running record
  const [runRecord] = await db.insert(scheduledJobRuns).values({
    id: Date.now(),
    jobName: job.name,
    status: "running",
    startedAt: new Date(),
  }).returning();
  const runId = runRecord.id;

  try {
    const result = await job.handler();
    const duration = Date.now() - startTime;

    await db.update(scheduledJobRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        duration,
        itemsProcessed: result.itemsProcessed,
        result: result.details,
      })
      .where(eq(scheduledJobRuns.id, Number(runId)));

    console.log(`[Scheduler] Completed ${job.name} in ${duration}ms (${result.itemsProcessed} items)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Scheduler] Failed ${job.name}:`, error.message);

    await db.update(scheduledJobRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        duration,
        error: error.message || "Unknown error",
      })
      .where(eq(scheduledJobRuns.id, Number(runId)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB 1: Subscription Health Check (runs daily at 6 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "subscription-health-check",
  description: "Check expiring subscriptions, flag past-due accounts, reset monthly quotas",
  schedule: "0 6 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    let processed = 0;
    const details: Record<string, any> = {};

    // Find subscriptions expiring in 3 days
    const expiringSubs = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.currentPeriodEnd, threeDaysFromNow),
        gte(subscriptions.currentPeriodEnd, now),
      ))
      .limit(1000);

    for (const sub of expiringSubs) {
      await db.insert(notifications).values({
        userId: sub.userId,
        type: "subscription",
        title: "Subscription Expiring Soon",
        message: `Your ${sub.plan} subscription expires in less than 3 days. Renew to avoid service interruption.`,
        actionUrl: "/subscriptions",
      });
      processed++;
    }
    details.expiringNotified = expiringSubs.length;

    // Find past-due subscriptions (period ended but still active)
    const pastDueSubs = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.status, "active"),
        lt(subscriptions.currentPeriodEnd, now),
      ))
      .limit(1000);

    for (const sub of pastDueSubs) {
      await db.update(subscriptions)
        .set({ status: "past_due" })
        .where(eq(subscriptions.id, sub.id));
      processed++;
    }
    details.markedPastDue = pastDueSubs.length;

    // Reset monthly quotas for subscriptions at period start
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (now.getDate() === 1) {
      await db.update(subscriptions)
        .set({ usedQuota: 0 })
        .where(eq(subscriptions.status, "active"));
      details.quotasReset = true;
    }

    return { itemsProcessed: processed, details };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 2: Certificate Expiry Checker (runs daily at 7 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "certificate-expiry-check",
  description: "Flag certificates expiring within 30 days and notify owners",
  schedule: "0 7 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let processed = 0;

    // Find active certificates expiring within 30 days
    const expiringCerts = await db.select()
      .from(certificates)
      .where(and(
        eq(certificates.status, "active"),
        lte(certificates.expiresAt, thirtyDaysFromNow),
        gte(certificates.expiresAt, now),
      ))
      .limit(1000);

    for (const cert of expiringCerts) {
      await db.insert(notifications).values({
        userId: cert.userId,
        type: "certificate",
        title: "Certificate Expiring Soon",
        message: `Certificate #${cert.certificateNumber} expires on ${cert.expiresAt?.toLocaleDateString()}. Renew it to maintain product authenticity.`,
        actionUrl: "/certificates",
      });
      processed++;
    }

    // Auto-expire certificates that have passed their expiry date
    await db.update(certificates)
      .set({ status: "expired" })
      .where(and(
        eq(certificates.status, "active"),
        lt(certificates.expiresAt, now),
      ));

    return {
      itemsProcessed: processed,
      details: { expiringNotified: expiringCerts.length, autoExpired: "checked" },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 3: Lead Nurturing & Stale Lead Follow-up (runs daily at 9 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "lead-nurturing",
  description: "Identify stale leads, update scores, and sync unsynced leads to HubSpot",
  schedule: "0 9 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let processed = 0;
    const details: Record<string, any> = {};

    // Find new leads not contacted in 7 days
    const staleLeads = await db.select()
      .from(leads)
      .where(and(
        eq(leads.status, "new"),
        lt(leads.createdAt, sevenDaysAgo),
      ))
      .limit(500);

    details.staleLeadsFound = staleLeads.length;

    // Sync unsynced leads to HubSpot
    if (isHubSpotConfigured()) {
      const newLeads = await db.select()
        .from(leads)
        .where(eq(leads.status, "new"))
        .limit(20);

      let synced = 0;
      for (const lead of newLeads) {
        try {
          await syncLeadToHubSpot({
            email: lead.email,
            name: lead.name || undefined,
            company: lead.company || undefined,
            source: lead.source || "website",
          });
          synced++;
        } catch { /* skip failed syncs */ }
      }
      details.hubspotSynced = synced;
      processed += synced;
    }

    return { itemsProcessed: processed, details };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 4: Database Cleanup (runs daily at 3 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "database-cleanup",
  description: "Purge old read notifications, stale job runs, and expired sessions",
  schedule: "0 3 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let processed = 0;
    const details: Record<string, any> = {};

    // Delete read notifications older than 30 days
    await db.delete(notifications)
      .where(and(
        eq(notifications.isRead, 1),
        lt(notifications.createdAt, thirtyDaysAgo),
      ));
    details.oldNotificationsDeleted = "checked";
    processed++;

    // Delete completed job runs older than 90 days
    await db.delete(scheduledJobRuns)
      .where(and(
        eq(scheduledJobRuns.status, "completed"),
        lt(scheduledJobRuns.startedAt, ninetyDaysAgo),
      ));
    details.oldJobRunsDeleted = "checked";
    processed++;

    return { itemsProcessed: processed, details };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 5: Weekly Analytics Digest (runs every Monday at 8 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "weekly-analytics-digest",
  description: "Compile weekly platform stats and notify owner",
  schedule: "0 8 * * 1",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Count new users this week
    const [newUsersResult] = await db.select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, oneWeekAgo));
    const newUsers = newUsersResult?.count || 0;

    // Count authentications this week
    const [authsResult] = await db.select({ count: count() })
      .from(authentications)
      .where(gte(authentications.createdAt, oneWeekAgo));
    const newAuths = authsResult?.count || 0;

    // Count new leads this week
    const [leadsResult] = await db.select({ count: count() })
      .from(leads)
      .where(gte(leads.createdAt, oneWeekAgo));
    const newLeads = leadsResult?.count || 0;

    // Count payments this week
    const [paymentsResult] = await db.select({ count: count() })
      .from(payments)
      .where(gte(payments.createdAt, oneWeekAgo));
    const newPayments = paymentsResult?.count || 0;

    // Total active subscriptions
    const [activeSubs] = await db.select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));
    const totalActiveSubs = activeSubs?.count || 0;

    // HubSpot CRM stats
    let crmStats = { contacts: 0, companies: 0, deals: 0 };
    if (isHubSpotConfigured()) {
      try {
        const stats = await getCRMStats();
        crmStats = { contacts: stats.contacts, companies: stats.companies, deals: stats.deals };
      } catch { /* skip */ }
    }

    const digest = `📊 AuthiChain Weekly Digest (${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()})

New Users: ${newUsers}
Authentications: ${newAuths}
New Leads: ${newLeads}
Payments: ${newPayments}
Active Subscriptions: ${totalActiveSubs}

HubSpot CRM: ${crmStats.contacts} contacts | ${crmStats.companies} companies | ${crmStats.deals} deals`;

    await notifyOwner({
      title: "AuthiChain Weekly Analytics Digest",
      content: digest,
    });

    return {
      itemsProcessed: 1,
      details: { newUsers, newAuths, newLeads, newPayments, totalActiveSubs, crmStats },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 6: HubSpot CRM Sync (runs every 4 hours)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "hubspot-crm-sync",
  description: "Sync new leads and payment events to HubSpot CRM",
  schedule: "0 */4 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    if (!isHubSpotConfigured()) {
      return { itemsProcessed: 0, details: { skipped: "HubSpot not configured" } };
    }

    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    let synced = 0;

    // Sync recent leads
    const recentLeads = await db.select()
      .from(leads)
      .where(gte(leads.createdAt, fourHoursAgo))
      .limit(50);

    for (const lead of recentLeads) {
      try {
        await syncLeadToHubSpot({
          email: lead.email,
          name: lead.name || undefined,
          company: lead.company || undefined,
          source: lead.source || "website",
        });
        synced++;
      } catch { /* skip failed */ }
    }

    return {
      itemsProcessed: synced,
      details: { leadsFound: recentLeads.length, leadsSynced: synced },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 7: Customer Health Score Update (runs daily at 5 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "customer-health-score",
  description: "Recalculate customer health scores based on usage, payments, and engagement",
  schedule: "0 5 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let processed = 0;

    // Get all active subscribers
    const activeSubs = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .limit(5000);

    for (const sub of activeSubs) {
      // Calculate score factors
      const quotaUsage = sub.usedQuota && sub.monthlyQuota
        ? Math.round((sub.usedQuota / sub.monthlyQuota) * 100)
        : 0;

      // Score: 0-100 based on usage (higher usage = healthier customer)
      let score = Math.min(100, quotaUsage);

      // Bonus for higher-tier plans
      if (sub.plan === "enterprise") score = Math.min(100, score + 20);
      else if (sub.plan === "professional") score = Math.min(100, score + 10);

      // Determine trend
      const [existing] = await db.select()
        .from(customerHealthScores)
        .where(eq(customerHealthScores.userId, sub.userId))
        .orderBy(desc(customerHealthScores.lastCalculatedAt))
        .limit(1);

      let trend: "improving" | "stable" | "declining" = "stable";
      if (existing) {
        if (score > existing.score + 5) trend = "improving";
        else if (score < existing.score - 5) trend = "declining";
      }

      await db.insert(customerHealthScores).values({
        userId: sub.userId,
        score,
        factors: { quotaUsage, plan: sub.plan, billingCycle: sub.billingCycle },
        trend,
        lastCalculatedAt: new Date(),
      });

      processed++;
    }

    return { itemsProcessed: processed, details: { subscribersScored: processed } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 8: Fraud Detection Sweep (runs every 6 hours)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "fraud-detection-sweep",
  description: "Detect suspicious authentication patterns and flag potential fraud",
  schedule: "0 */6 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    let flagged = 0;

    // Detect users with unusually high authentication attempts
    const highVolumeUsers = await db.select({
      userId: authentications.userId,
      authCount: count(),
    })
      .from(authentications)
      .where(gte(authentications.createdAt, sixHoursAgo))
      .groupBy(authentications.userId)
      .having(sql`count(*) > 50`);

    for (const user of highVolumeUsers) {
      await db.insert(fraudAlerts).values({
        userId: user.userId,
        alertType: "high_volume_auth",
        severity: "medium",
        description: `User performed ${user.authCount} authentications in the last 6 hours, which exceeds the threshold of 50.`,
        metadata: { authCount: user.authCount, period: "6h" },
      });
      flagged++;
    }

    // Detect products with multiple failed authentications
    const failedAuths = await db.select({
      productId: authentications.productId,
      failCount: count(),
    })
      .from(authentications)
      .where(and(
        gte(authentications.createdAt, sixHoursAgo),
        eq(authentications.result, "counterfeit"),
      ))
      .groupBy(authentications.productId)
      .having(sql`count(*) > 5`);

    for (const item of failedAuths) {
      if (item.productId) {
        await db.insert(fraudAlerts).values({
          productId: item.productId,
          alertType: "multiple_counterfeit_flags",
          severity: "high",
          description: `Product received ${item.failCount} counterfeit flags in the last 6 hours.`,
          metadata: { failCount: item.failCount, period: "6h" },
        });
        flagged++;
      }
    }

    return { itemsProcessed: flagged, details: { highVolumeUsers: highVolumeUsers.length, failedAuthProducts: failedAuths.length } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 9a: Founders DreamDash — Lead Scoring Refresh (every 30 minutes)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "dreamdash-lead-scoring",
  description: "Recalculate lead scores based on engagement signals across all four domains",
  schedule: "*/30 * * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { skipped: true } };

    const allLeads = await db.select().from(leads)
      .where(sql`${leads.status} IN ('new', 'contacted', 'qualified')`)
      .limit(500);

    let updated = 0;
    for (const lead of allLeads) {
      let score = lead.score || 0;
      if (lead.emailOpened) score = Math.min(score + 15, 100);
      if (lead.emailClicked) score = Math.min(score + 25, 100);
      if (lead.demoStarted) score = Math.min(score + 40, 100);
      if (lead.contractSent) score = Math.min(score + 50, 100);
      if (lead.contractSigned) score = 100;
      if (lead.isVip) score = Math.min(score + 30, 100);

      if (score !== (lead.score || 0)) {
        await db.update(leads).set({ score }).where(eq(leads.id, lead.id));
        updated++;
      }
    }

    return { itemsProcessed: updated, details: { totalEvaluated: allLeads.length, updated } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 9b: Founders DreamDash — Auto Stage Advancement (every 2 hours)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "dreamdash-stage-advance",
  description: "Auto-advance high-scoring leads through the deal pipeline",
  schedule: "0 */2 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { skipped: true } };

    let advanced = 0;

    // Advance new leads with score >= 50 to contacted
    const newHighScore = await db.select().from(leads)
      .where(and(eq(leads.status, 'new'), gte(leads.score, 50)))
      .limit(100);
    for (const lead of newHighScore) {
      await db.update(leads).set({ status: 'contacted' }).where(eq(leads.id, lead.id));
      advanced++;
    }

    // Advance contacted leads with score >= 70 to qualified
    const contactedHigh = await db.select().from(leads)
      .where(and(eq(leads.status, 'contacted'), gte(leads.score, 70)))
      .limit(100);
    for (const lead of contactedHigh) {
      await db.update(leads).set({ status: 'qualified' }).where(eq(leads.id, lead.id));
      advanced++;
    }

    // Advance qualified leads with demo started to demoed
    const qualifiedDemoed = await db.select().from(leads)
      .where(and(eq(leads.status, 'qualified'), eq(leads.demoStarted, true)))
      .limit(100);
    for (const lead of qualifiedDemoed) {
      await db.update(leads).set({ status: 'demoed' }).where(eq(leads.id, lead.id));
      advanced++;
    }

    // Advance demoed leads with contract sent to contracted
    const demoedContract = await db.select().from(leads)
      .where(and(eq(leads.status, 'demoed'), eq(leads.contractSent, true)))
      .limit(100);
    for (const lead of demoedContract) {
      await db.update(leads).set({ status: 'contracted' }).where(eq(leads.id, lead.id));
      advanced++;
    }

    // Advance contracted leads with contract signed to signed
    const contractedSigned = await db.select().from(leads)
      .where(and(eq(leads.status, 'contracted'), eq(leads.contractSigned, true)))
      .limit(100);
    for (const lead of contractedSigned) {
      await db.update(leads).set({ status: 'signed' }).where(eq(leads.id, lead.id));
      advanced++;
    }

    return { itemsProcessed: advanced, details: { newToContacted: newHighScore.length, contactedToQualified: contactedHigh.length, qualifiedToDemo: qualifiedDemoed.length, demoToContract: demoedContract.length, contractToSigned: contractedSigned.length } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 9: Autonomous Revenue Pipeline Tick (every 2 minutes - ACCELERATED)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "autonomous-pipeline-tick",
  description: "Run AgentZ revenue pipeline: find leads, draft outreach, monitor deals",
  schedule: "*/2 * * * *", // every 2 minutes
  enabled: ENV.autonomousPipelineEnabled,
  handler: async (): Promise<JobResult> => {
    const { runPipelineTick } = await import("./jobs/pipeline-tick");
    const result = await runPipelineTick();
    if ("skipped" in result && result.skipped) {
      return { itemsProcessed: 0, details: result };
    }
    const r = result as any;
    const tasksRan = r.taskResults?.ran ?? 0;
    return {
      itemsProcessed: tasksRan,
      details: {
        budgetMonitor: r.budgetMonitor,
        dunning:        r.dunning,
        retention:      r.retention,
        taskResults:    r.taskResults,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Scheduler Initialization
// ═══════════════════════════════════════════════════════════════════════════
export async function initializeScheduler(): Promise<void> {
  console.log("[Scheduler] Initializing scheduled jobs...");

  let cron;
  try {
    // Specifier is computed at runtime so the Worker bundler (esbuild) does
    // NOT statically include node-cron — it references __dirname at module
    // top level, which is undefined in Cloudflare Workers ESM and crashes the
    // worker on startup. In Node this resolves normally; in Workers the
    // dynamic import throws and we fall through to the warn+return below.
    const moduleName = ["node", "cron"].join("-");
    cron = (await import(/* @vite-ignore */ moduleName)).default;
  } catch (err) {
    console.warn("[Scheduler] node-cron not available in this environment, skipping initialization.");
    return;
  }

  for (const job of jobs) {
    if (!job.enabled) {
      console.log(`[Scheduler] Skipping disabled job: ${job.name}`);
      continue;
    }

    const task = cron.schedule(job.schedule, () => {
      executeJob(job).catch(err =>
        console.error(`[Scheduler] Unhandled error in ${job.name}:`, err)
      );
    });

    scheduledTasks.set(job.name, task);
    console.log(`[Scheduler] Registered: ${job.name} (${job.schedule})`);
  }

  console.log(`[Scheduler] ${scheduledTasks.size} jobs registered and running`);
}

export function stopScheduler(): void {
  Array.from(scheduledTasks.entries()).forEach(([name, task]) => {
    task.stop();
    console.log(`[Scheduler] Stopped: ${name}`);
  });
  scheduledTasks.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB 10: Vertical Cloner (Runs every 10 minutes)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "vertical-cloner",
  description: "Monitor for new industry expansion opportunities and spawn missions",
  schedule: "*/10 * * * *",
  enabled: true,
  handler: async () => {
    const { runVerticalCloning } = await import("./jobs/vertical-cloner");
    await runVerticalCloning();
    return { itemsProcessed: 2, details: { status: "cloning_cycle_complete", verticals: ["EV_BATTERY", "ARTISAN_COFFEE"] } };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 11: StrainChain METRC Sync (Runs every 1 hour)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "strainchain-metrc-sync",
  description: "Sync METRC transfers and auto-anchor to the Truth Layer",
  schedule: "0 * * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const { runStrainChainSync } = await import("./jobs/strainchain-sync");
    return await runStrainChainSync();
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 12: Newsjacking Monitor (Runs every 30 minutes)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "newsjacking-monitor",
  description: "Monitor global news for supply chain incidents and trigger PR missions",
  schedule: "*/30 * * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const { runNewsjackingMonitor } = await import("./agents/news-pr");
    // Simulate a task object for the agent
    await runNewsjackingMonitor({ 
      missionId: "SYSTEM_PR", 
      payload: { topics: ['medical device recall', 'counterfeit pharma', 'luxury forgery'] } 
    } as any);
    return { itemsProcessed: 1, details: { status: "news_scan_complete" } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 13: Staking Rewards Distribution (Runs daily at 4 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "staking-rewards",
  description: "Distribute validation rewards to active $QRON stakers",
  schedule: "0 4 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { error: "No DB" } };
    
    // Simple logic: apply 12.5% APY / 365 to all active positions.
    // Idempotency: only positions not rewarded in the last ~23h are eligible,
    // so a re-run or process restart on the same day cannot double-distribute.
    const rewardCutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const activePositions = await db.select().from(stakingPositions).where(
      and(
        eq(stakingPositions.status, "active"),
        lt(stakingPositions.lastRewardCalculation, rewardCutoff),
      )
    );
    const now = new Date();
    for (const pos of activePositions) {
      const dailyReward = (Number(pos.amount) * 0.125) / 365;
      await db.insert(qronRewardLedger).values({
        agentId: pos.agentId || 0,
        userId: pos.userId,
        amount: dailyReward.toFixed(9),
        reason: "staking_reward",
        referenceType: "staking_position",
        referenceId: pos.id,
        status: "pending"
      });
      // Stamp the position so it is not rewarded again until the next window.
      await db.update(stakingPositions)
        .set({ lastRewardCalculation: now, updatedAt: now })
        .where(eq(stakingPositions.id, pos.id));
    }
    return { itemsProcessed: activePositions.length, details: { status: "rewards_distributed" } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 14: Payout Preparation (Runs daily at 5 AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
// Queues eligible payouts (affiliate commissions, staking rewards) as
// `pending_approval`. This moves NO funds — an admin must approve a batch and
// PAYOUTS_ENABLED must be true before payouts.execute sends anything.
registerJob({
  name: "payout-preparation",
  description: "Queue eligible affiliate/staking payouts for human approval (no funds move)",
  schedule: "0 5 * * *",
  enabled: ENV.autonomousPipelineEnabled,
  handler: async (): Promise<JobResult> => {
    const { preparePayouts } = await import("./payouts/service");
    const res = await preparePayouts();
    return { itemsProcessed: res.queued, details: { ...res, note: "queued for approval; no funds moved" } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 15: Analytics Snapshot (Runs daily at 10 PM UTC)
// ═══════════════════════════════════════════════════════════════════════════
// Read-only reporting: compiles admin metrics, revenue, funnel, and cohort
// analytics to orchestration/analytics-latest.json and the activity log. Was
// implemented but never registered, so the snapshot was never produced.
registerJob({
  name: "analytics-snapshot",
  description: "Compile daily admin/revenue analytics snapshot to disk + activity log",
  schedule: "0 22 * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const { runAnalyticsSnapshot } = await import("./jobs/analytics-snapshot");
    const res = await runAnalyticsSnapshot();
    return { itemsProcessed: 1, details: { outputPath: res.outputPath, generatedAt: res.timestamp } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 16: Lead Capture → CRM Sync (every 15 minutes)
// Syncs new leads from lead_captures (Supabase/frontend) into the Drizzle leads table
// so the autonomous agents, pipeline-tick, and email system can process them.
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "lead-capture-sync",
  description: "Sync lead_captures (frontend forms) into the CRM leads table for autonomous processing",
  schedule: "*/15 * * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { skipped: true } };

    const existingEmails = await db.select({ email: leads.email }).from(leads);
    const existingSet = new Set(existingEmails.map(e => e.email));

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return { itemsProcessed: 0, details: { skipped: true, reason: "no_supabase_config" } };

    const admin = createClient(supabaseUrl, supabaseKey);
    const { data: captures } = await admin
      .from("lead_captures")
      .select("email, name, source, product_interest, score, status, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!captures || captures.length === 0) return { itemsProcessed: 0, details: { noNewCaptures: true } };

    let synced = 0;
    for (const cap of captures) {
      if (existingSet.has(cap.email)) continue;

      await db.insert(leads).values({
        email: cap.email,
        name: cap.name || "Prospect",
        source: cap.source || "landing_form",
        score: cap.score || 0,
        leadScore: cap.score || 0,
        status: cap.status || "new",
        industry: cap.product_interest || undefined,
        segment: (cap.product_interest || "").toUpperCase(),
        metadata: {
          synced_from: "lead_captures",
          product_interest: cap.product_interest,
          original_metadata: cap.metadata,
          synced_at: new Date().toISOString(),
        },
      });
      existingSet.add(cap.email);
      synced++;
    }

    return { itemsProcessed: synced, details: { totalCaptures: captures.length, synced } };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB 17: Auto-Nurture Email Draft Creator (every hour)
// For qualified leads that haven't been contacted, creates email drafts
// in the email_drafts table for approval/sending via the existing workflow.
// ═══════════════════════════════════════════════════════════════════════════
registerJob({
  name: "auto-nurture-drafts",
  description: "Create email drafts for qualified leads awaiting first contact",
  schedule: "0 * * * *",
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const db = await getDb();
    if (!db) return { itemsProcessed: 0, details: { skipped: true } };

    const qualifiedLeads = await db.select().from(leads)
      .where(and(
        eq(leads.status, "new"),
        gte(leads.score, 50),
        isNull(leads.lastContactedAt)
      ))
      .limit(20);

    let draftsCreated = 0;

    const segmentTemplates: Record<string, { subject: string; body: string }> = {
      QRON: {
        subject: "QRON.space — AI-Powered QR Codes for Your Business",
        body: "Hi {{name}},\n\nThanks for your interest in QRON.space! We create QR codes that are actually beautiful — powered by AI vision markers.\n\nYour business gets:\n- AI-generated art that converts scans 3x better\n- Detailed scan analytics & heatmaps\n- Dynamic linking (update URLs without reprinting)\n\nWould love to show you a quick demo. Reply to pick a time.\n\nBest,\nThe QRON Team",
      },
      AUTHICHAIN: {
        subject: "AuthiChain — Digital Credentials for Your Organization",
        body: "Hi {{name}},\n\nAuthiChain secures your digital credentials end-to-end with blockchain verification.\n\nUse cases:\n- Employee certifications\n- Product authenticity proofs\n- Blockchain-verified documents\n\nWant to see how it works? Reply and we'll set up a walkthrough.\n\nBest,\nAuthiChain Team",
      },
      GOVCHAIN: {
        subject: "GovChain.us — Governance Infrastructure for DAOs",
        body: "Hi {{name}},\n\nBuild sustainable DAOs with GovChain governance infrastructure.\n\nFeatures:\n- Multi-sig voting with delegation\n- Staking rewards ($QRON yields 12.4%)\n- Proposal management & archival\n\nInterested in a technical walkthrough? Just reply.\n\nBest,\nGovChain Partnerships",
      },
      STRAINCHAIN: {
        subject: "StrainChain.io — Full Supply Chain Visibility",
        body: "Hi {{name}},\n\nStrainChain gives you complete supply chain transparency.\n\nTrack:\n- GPS locations in real-time\n- Temperature & humidity compliance\n- Immutable blockchain audit trail\n\nWant to see it in action? Reply to schedule a demo.\n\nBest,\nStrainChain Team",
      },
    };

    for (const lead of qualifiedLeads) {
      const segment = (lead.segment || "QRON").toUpperCase();
      const template = segmentTemplates[segment] || segmentTemplates.QRON;
      const body = template.body.replace(/\{\{name\}\}/g, lead.name || "there");

      await db.insert(emailDrafts).values({
        prospectEmail: lead.email,
        prospectName: lead.name || "Prospect",
        prospectCompany: lead.company || undefined,
        industry: lead.industry || undefined,
        subject: template.subject,
        body,
        templateUsed: `auto_nurture_${segment.toLowerCase()}`,
        status: "pending",
        generatedBy: "dreamdash_auto_nurture",
      });

      await db.update(leads).set({
        status: "contacted",
        lastContactedAt: new Date(),
      }).where(eq(leads.id, lead.id));

      draftsCreated++;
    }

    return { itemsProcessed: draftsCreated, details: { leadsChecked: qualifiedLeads.length, draftsCreated } };
  },
});

// ─── Global Kill Switch ─────────────────────────────────────────────────────

let _systemActive = true;

export function getSystemStatus() {
  return {
    isActive: _systemActive,
    activeJobs: scheduledTasks.size,
    totalJobs: jobs.length,
    timestamp: new Date().toISOString(),
  };
}

export async function toggleKillSwitch(active: boolean): Promise<boolean> {
  if (_systemActive === active) return _systemActive;

  _systemActive = active;
  console.log(`[System] Kill switch activated: ${!active}`);

  if (active) {
    console.log("[System] Resuming all automation routines...");
    await initializeScheduler();
  } else {
    console.log("[System] HALTING ALL AUTOMATION. Emergency stop triggered.");
    stopScheduler();
  }

  return _systemActive;
}

// ─── API for Admin Dashboard ────────────────────────────────────────────────
export function getRegisteredJobs() {
  return jobs.map(j => ({
    name: j.name,
    description: j.description,
    schedule: j.schedule,
    enabled: j.enabled,
    isRunning: scheduledTasks.has(j.name),
  }));
}

export async function getJobHistory(jobName?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  if (jobName) {
    return db.select()
      .from(scheduledJobRuns)
      .where(eq(scheduledJobRuns.jobName, jobName))
      .orderBy(desc(scheduledJobRuns.startedAt))
      .limit(limit);
  }

  return db.select()
    .from(scheduledJobRuns)
    .orderBy(desc(scheduledJobRuns.startedAt))
    .limit(limit);
}

export async function runJobManually(jobName: string): Promise<boolean> {
  const job = jobs.find(j => j.name === jobName);
  if (!job) return false;
  await executeJob(job);
  return true;
}
