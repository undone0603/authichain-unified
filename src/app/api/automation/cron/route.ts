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
    const { runProgrammaticSeoBatch, selectUnpublishedJobs, SEO_KEYWORD_POOL } = await import('../../../../../server/agents/seo-content');
    const { listPublishedSlugs } = await import('../../../../../server/agents/db-helpers');
    const { listSeoSlugs } = await import('../../../../../src/lib/seo-pages');
    const { getDb } = await import('../../../../../server/db');
    const db = await getDb();
    // Excludes both DB-published slugs AND the statically committed ones
    // (content/seo/pages.json already covers some pool keywords) so the
    // batch never wastes an LLM call regenerating a page that already exists.
    const publishedSlugs = [...listSeoSlugs(), ...(await listPublishedSlugs(db))];
    // The pool is much larger than the content.publish guardrail's daily cap
    // (10) on purpose — it's exhausted gradually, a handful of new pages per
    // run, not regenerated from scratch every day. New keywords get appended
    // to SEO_KEYWORD_POOL as they're identified rather than replacing
    // exhausted ones.
    const seoJobs = selectUnpublishedJobs(SEO_KEYWORD_POOL, publishedSlugs, 8);
    const pages = await runProgrammaticSeoBatch(seoJobs, db);
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
