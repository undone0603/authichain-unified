import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

/**
 * GET /api/cron/jobs?job=<name>
 *
 * Vercel Cron target — runs hourly.
 * Triggers a specific registered scheduled job by name, or initialises the
 * full scheduler (which registers all jobs and runs any that are overdue).
 *
 * Required env: CRON_SECRET
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobName = searchParams.get('job');
  const started = Date.now();

  try {
    const { initializeScheduler, runJobManually, getRegisteredJobs } = await import('../../../../../server/scheduled-jobs');

    if (jobName) {
      const success = await runJobManually(jobName);
      if (!success) {
        const available = getRegisteredJobs().map(j => j.name);
        return NextResponse.json(
          { error: `Job "${jobName}" not found`, available },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, job: jobName, durationMs: Date.now() - started });
    }

    // No specific job — initialise the scheduler to register all jobs
    await initializeScheduler();
    const jobs = getRegisteredJobs();
    return NextResponse.json({
      ok: true,
      registeredJobs: jobs.length,
      jobs: jobs.map(j => ({ name: j.name, schedule: j.schedule, enabled: j.enabled })),
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CronJobs]', message);
    return NextResponse.json({ error: message, durationMs: Date.now() - started }, { status: 500 });
  }
}
