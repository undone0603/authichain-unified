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
 * GET /api/cron/pipeline
 *
 * Vercel Cron target — runs every 5 minutes.
 * Executes the AgentZ pipeline tick: budget monitor, dunning, retention,
 * weekly digest, organic traffic, browser agents, and UCB1-prioritised mission tasks.
 *
 * Required env: CRON_SECRET (Vercel auto-injects the bearer token for its own crons).
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  try {
    const { runPipelineTick } = await import('../../../../../server/jobs/pipeline-tick');
    const result = await runPipelineTick({ force: true });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - started,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CronPipeline]', message);
    return NextResponse.json({ error: message, durationMs: Date.now() - started }, { status: 500 });
  }
}
