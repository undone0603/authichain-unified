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
  // Documented bridge: this Next.js API route is a standalone cron entry
  // point (src/app/api/**, not yet migrated off the db.ts singleton), so it
  // obtains its own db and threads it into the already-migrated
  // server/jobs/pipeline-tick.ts (Task 2b-2 scope).
  try {
    const { runPipelineTick } = await import('../../../../../server/jobs/pipeline-tick');
    const { getDb } = await import('../../../../../server/db');
    const db = await getDb();
    const tick = await runPipelineTick(db, { force: true });
    results.pipelineTick = tick;
  } catch (err) {
    results.pipelineTick = { error: err instanceof Error ? err.message : String(err) };
  }

  // Autonomous programmatic-SEO generation (owned-property content; no ToS gate).
  try {
    const { runProgrammaticSeoBatch } = await import('../../../../../server/agents/seo-content');
    const { getDb } = await import('../../../../../server/db');
    const db = await getDb();
    const seoJobs = [
      { brandKey: 'authichain', keyword: 'blockchain product authentication' },
      { brandKey: 'authichain', keyword: 'anti-counterfeit qr verification' },
      { brandKey: 'strainchain', keyword: 'cannabis blockchain provenance' },
      { brandKey: 'strainchain', keyword: 'metrc compliance blockchain' },
      { brandKey: 'govchain', keyword: 'government document verification blockchain' },
      { brandKey: 'qron', keyword: 'ai qr code art generator' },
    ] as const;
    const pages = await runProgrammaticSeoBatch([...seoJobs], db);
    results.seo = { generated: pages.length, slugs: pages.map((p) => p.slug) };
  } catch (err) {
    results.seo = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    ok: true,
    results,
    timestamp: new Date().toISOString(),
  });
}
