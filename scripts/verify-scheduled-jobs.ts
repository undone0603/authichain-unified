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
import { eq } from 'drizzle-orm';

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
    // Identify this run's row by diffing the set of ids for this job before
    // and after. Not by ordering — ordering was wrong twice, for two unrelated
    // reasons, and this table can support neither assumption:
    //
    //   1. `max(id)` then `id > before`. Eight rows written in June 2026 carry
    //      Date.now() milliseconds as their id (1781630400025 and neighbours)
    //      instead of a sequence value, while the sequence is at ~1112. So
    //      max(id) was a 2026-06-16 sentinel, every genuine insert landed far
    //      below it, and nothing matched — six jobs ran, five passed, and all
    //      six were reported as having written no row.
    //
    //   2. Newest row by `order by "startedAt" desc`. One vertical-cloner row
    //      has a NULL "startedAt", and Postgres sorts NULLs FIRST under DESC,
    //      so that row won both the before and after query and the ids matched.
    //      Same false "no ledger row", different cause.
    //
    // A set difference assumes neither that ids are ordered nor that timestamps
    // are present. It just asks which row is new.
    const idsBefore = new Set(
      (
        await db
          .select({ id: scheduledJobRuns.id })
          .from(scheduledJobRuns)
          .where(eq(scheduledJobRuns.jobName, name))
      ).map((r) => String(r.id)),
    );

    process.stdout.write(`  ${name} … `);
    await runJobManually(name);

    const after = await db
      .select()
      .from(scheduledJobRuns)
      .where(eq(scheduledJobRuns.jobName, name));

    // No new id means executeJob wrote nothing at all. Silence is not success.
    const row = after.find((r) => !idsBefore.has(String(r.id)));

    if (!row) {
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
