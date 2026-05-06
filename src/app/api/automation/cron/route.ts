import { NextResponse } from 'next/server';
import { runDailyMaintenance } from '@/lib/automation';
import { AutonomousController } from '@/lib/autonomous-controller';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automation/cron
 *
 * Trigger daily business operations.
 * Security: Requires a CRON_API_KEY header.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.CRON_API_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: 'CRON_API_KEY not configured' }, { status: 503 });
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Run low-level maintenance (logs, counters)
    await runDailyMaintenance();

    // 2. Run high-level business cycle (leads, social, reporting)
    const controller = new AutonomousController();
    await controller.runDailyCycle();

    return NextResponse.json({
      ok: true,
      status: 'Daily business cycle complete',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { 
        error: 'Autonomous cycle failed', 
        detail: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}
