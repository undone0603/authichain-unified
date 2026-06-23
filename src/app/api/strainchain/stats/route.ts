import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/strainchain/stats
 *
 * Live aggregate stats for the StrainChain cannabis supply-chain pipeline.
 * Powers the strainchain.io landing page hero numbers. Counts are sourced
 * from the product_events audit trail — the immutable record of every
 * cultivate → harvest → lab_test → package → transfer → dispensary event.
 */
export async function GET() {
  try {
    const admin = getAdmin();

    const CHAIN_EVENTS = ['cultivated', 'harvested', 'lab_tested', 'packaged', 'transferred', 'dispensary_received'];

    const [labTested, cultivated, harvested, packaged, dispensaryReceived, registered] = await Promise.all(
      ['lab_tested', 'cultivated', 'harvested', 'packaged', 'dispensary_received', 'registered'].map(evType =>
        admin.from('product_events').select('*', { count: 'exact', head: true }).eq('event_type', evType),
      ),
    );

    const totalChainEvents = await Promise.all(
      CHAIN_EVENTS.map(evType =>
        admin.from('product_events').select('*', { count: 'exact', head: true }).eq('event_type', evType),
      ),
    ).then(results => results.reduce((sum, r) => sum + (r.count ?? 0), 0));

    const latestEvent = await admin
      .from('product_events')
      .select('occurred_at')
      .in('event_type', CHAIN_EVENTS)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      {
        lab_tests: labTested.count ?? 0,
        batches_cultivated: cultivated.count ?? 0,
        batches_harvested: harvested.count ?? 0,
        batches_packaged: packaged.count ?? 0,
        dispensary_receipts: dispensaryReceived.count ?? 0,
        batches_registered: registered.count ?? 0,
        total_chain_events: totalChainEvents,
        last_event_at: (latestEvent.data as { occurred_at?: string } | null)?.occurred_at ?? null,
      },
      { headers: CORS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
