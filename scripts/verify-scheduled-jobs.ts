/**
 * Runs named scheduled jobs against the real database and reports, per job,
 * whether the run actually succeeded.
 *
 * Why this exists as a separate thing from just calling the job:
 *
 * executeJob() catches every error, writes status='failed' to
 * scheduled_job_runs, and then RETURNS NORMALLY. Nothing throws. A script that
 * called runJobManually() in a loop would exit 0 with every job broken, and a
 * workflow wrapping it would go green. That is the same shape of blind spot
 * that let 750 of 982 job runs fail for months while the cron endpoint
 * returned 200 — so this reads the outcome back out of the ledger rather than
 * trusting the absence of an exception.
 *
 * Defaults to the six jobs that have never once succeeded. Their last failures
 * all predate the schema-drift fixes, so their handlers are believed fixed but
 * have never been observed working. This turns "fixed in code" into "observed
 * passing", which is the only claim worth making.
 *
 * Usage:
 *   DATABASE_URL=... pnpm tsx scripts/verify-scheduled-jobs.ts [job ...]
 *
 * Exits 1 if any job fails or writes no ledger row at all.
 */

import { getDb } from '../server/db';
import { runJobManually, getRegisteredJobs } from '../server/scheduled-jobs';
import { scheduledJobRuns } from '../drizzle/schema';
import { gt, desc, eq, and } from 'drizzle-orm';

/** The six with a 100% failure rate and no successful run on record. */
const NEVER_SUCCEEDED = [
  'vertical-cloner',
  'newsjacking-monitor',
  'strainchain-metrc-sync',
  'fraud-detection-sweep',
  'certificate-expiry-check',
  'staking-rewards',
];

async function main(): Promise<number> {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = requested.length ? requested : NEVER_SUCCEEDED;

  const db = await getDb();
  if (!db) {
    console.error('No database connection — DATABASE_URL is unset or unreachable.');
    return 2;
  }

  const known = new Set(getRegisteredJobs().map((j: { name: string }) => j.name));
  const unknown = targets.filter((t) => !known.has(t));
  if (unknown.length) {
    console.error(`Not registered jobs: ${unknown.join(', ')}`);
    console.error(`Known: ${[...known].join(', ')}`);
    return 2;
  }

  console.log(`Running ${targets.length} job(s) against the live database.\n`);

  const results: { job: string; status: string; items: number | null; error: string | null }[] = [];

  for (const name of targets) {
    // Anchor on the ledger's own id rather than a clock, so a slow clock or a
    // concurrent run of the same job cannot be mistaken for this one.
    const [latest] = await db
      .select({ id: scheduledJobRuns.id })
      .from(scheduledJobRuns)
      .orderBy(desc(scheduledJobRuns.id))
      .limit(1);
    const before = latest?.id ?? 0;

    process.stdout.write(`  ${name} … `);
    await runJobManually(name);

    const [row] = await db
      .select()
      .from(scheduledJobRuns)
      .where(and(gt(scheduledJobRuns.id, before), eq(scheduledJobRuns.jobName, name)))
      .orderBy(desc(scheduledJobRuns.id))
      .limit(1);

    if (!row) {
      // executeJob returns without writing anything when getDb() comes back
      // empty. Silence is not success.
      console.log('NO LEDGER ROW');
      results.push({ job: name, status: 'no-row', items: null, error: 'job wrote no run record' });
      continue;
    }

    console.log(row.status === 'completed' ? `ok (${row.itemsProcessed ?? 0} items)` : row.status.toUpperCase());
    results.push({
      job: name,
      status: row.status,
      items: row.itemsProcessed ?? null,
      error: row.error ?? null,
    });
  }

  const failed = results.filter((r) => r.status !== 'completed');

  console.log('\n─── Result ─────────────────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.status === 'completed' ? 'PASS' : 'FAIL'}  ${r.job}${r.items !== null ? `  (${r.items} items)` : ''}`);
    if (r.error) console.log(`        ${r.error.slice(0, 400)}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} completed.`);

  return failed.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(2);
  });
