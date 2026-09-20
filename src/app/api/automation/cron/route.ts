import { NextResponse } from 'next/server';
import {
  authorizeGenesis,
  genesisJson,
  runGenesisCycle,
} from '@/lib/genesis-cycle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/automation/cron
 *
 * Genesis / daily economy tick. Bearer CRON_SECRET.
 * Drip email, programmatic SEO, and gov-mint stay off.
 * AgentZ orchestration is agentz-orchestration.yml, not this cron
 * (docs/operations/PUBLIC_LOOP_FREEZE.md, AGENTZ_ORCHESTRATION.md).
 */
export async function GET(request: Request) {
  if (!authorizeGenesis(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runGenesisCycle();
  return NextResponse.json(genesisJson(results));
}
