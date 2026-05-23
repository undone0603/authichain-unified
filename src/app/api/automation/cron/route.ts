import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runDailyMaintenance } from '@/lib/automation';
import { AutonomousController } from '@/lib/autonomous-controller';

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
 * GET /api/automation/cron
 *
 * Daily business cycle cron (06:00 UTC).
 * Runs: DB maintenance → autonomous business controller → server-side jobs snapshot.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    await runDailyMaintenance();
    results.maintenance = 'ok';
  } catch (err) {
    results.maintenance = err instanceof Error ? err.message : String(err);
  }

  try {
    const controller = new AutonomousController();
    await controller.runDailyCycle();
    results.businessCycle = 'ok';
  } catch (err) {
    results.businessCycle = err instanceof Error ? err.message : String(err);
  }

  // Also fire a forced pipeline tick for the server-side autonomous jobs
  try {
    const { runPipelineTick } = await import('../../../../../server/jobs/pipeline-tick');
    const tick = await runPipelineTick({ force: true });
    results.pipelineTick = tick;
  } catch (err) {
    results.pipelineTick = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    ok: true,
    results,
    timestamp: new Date().toISOString(),
  });
}
