/**
 * Retry failed GENERATE_PROPOSAL mission tasks (cap 5).
 *
 * Resets status to pending, clears error, then runTask. Soft-fails per task.
 *
 * Usage:
 *   DRY_RUN=true  pnpm exec tsx scripts/retry-closer-proposals.ts
 *   DRY_RUN=false pnpm exec tsx scripts/retry-closer-proposals.ts
 *
 * Also invoked via: pnpm exec tsx scripts/revenue-cycle.ts --phase=retry-closer
 */

import { and, desc, eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDryRun = process.env.DRY_RUN !== "false";
const CAP = Math.min(
  Math.max(Number(process.env.CLOSER_RETRY_CAP ?? "5") || 5, 1),
  20
);

export type RetryCloserSummary = {
  found: number;
  reset: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

export async function retryCloserProposals(): Promise<RetryCloserSummary> {
  console.log(`\n=== PHASE: retry-closer === dry_run=${isDryRun} cap=${CAP}`);

  const summary: RetryCloserSummary = {
    found: 0,
    reset: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  const { getDb } = await import("../server/db");
  const { missionTasks } = await import("../drizzle/schema");

  const db = await getDb();

  const failed = await db
    .select()
    .from(missionTasks)
    .where(
      and(
        eq(missionTasks.kind, "GENERATE_PROPOSAL"),
        eq(missionTasks.status, "failed")
      )
    )
    .orderBy(desc(missionTasks.updatedAt))
    .limit(CAP);

  summary.found = failed.length;
  console.log(`  Failed GENERATE_PROPOSAL tasks found: ${failed.length}`);

  if (failed.length === 0) {
    console.log("  Nothing to retry");
    return summary;
  }

  for (const task of failed) {
    const errPreview = (task.error ?? "").slice(0, 120);
    console.log(
      `  • task=${task.id} mission=${task.missionId}` +
        (errPreview ? ` error=${JSON.stringify(errPreview)}` : "")
    );

    if (isDryRun) {
      console.log(`    WOULD reset→pending + runTask`);
      summary.skipped++;
      continue;
    }

    try {
      await db
        .update(missionTasks)
        .set({
          status: "pending",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(missionTasks.id, task.id));
      summary.reset++;
      console.log(`    ✅ reset to pending`);
    } catch (err: any) {
      summary.failed++;
      console.warn(
        `    ⚠️  reset failed (soft): ${err?.message?.slice(0, 160)}`
      );
      continue;
    }

    try {
      const { runTask } = await import("../server/jobs/task-runner");
      const refreshed = { ...task, status: "pending" as const, error: null };
      console.log(`    ▶ runTask ${task.id}`);
      const result = await runTask(refreshed);
      if (result.ok) {
        summary.succeeded++;
        console.log(`    ✅ executed ${task.id}`);
      } else {
        summary.failed++;
        console.warn(`    ⚠️  runTask ${task.id} returned ok=false`);
      }
    } catch (err: any) {
      summary.failed++;
      console.warn(
        `    ⚠️  runTask ${task.id} failed (soft): ${err?.message?.slice(0, 160)}`
      );
    }
  }

  console.log(
    `  Done. found=${summary.found} reset=${summary.reset}` +
      ` succeeded=${summary.succeeded} failed=${summary.failed}` +
      ` skipped=${summary.skipped}`
  );
  return summary;
}

async function main() {
  console.log(`retry-closer-proposals starting — dry_run=${isDryRun}`);
  try {
    await retryCloserProposals();
    console.log("\n✅ retry-closer complete");
  } catch (err: any) {
    console.error(`retry-closer failed: ${err?.message ?? err}`);
    process.exit(isDryRun ? 0 : 1);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(err => {
    console.error(err);
    process.exit(isDryRun ? 0 : 1);
  });
}
