import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth-api';
import { createClient } from '@supabase/supabase-js';
import { processIndustrialEvent, IndustrialTheater } from '@/lib/industrial/telemetry';
import { anchorEdgeHash } from '@/lib/blockchain';
import { logAutomation } from '@/lib/automation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/industrial/telemetry
 * 
 * Secure ingestor for Metrc (Theater 1) and BMW (Theater 3) data.
 * Automates State Hash generation and Polygon anchoring.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Industrial Node
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Authentication missing' }, { status: 401 });
    }

    const userId = await verifyApiKey(apiKey);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid Industrial Key' }, { status: 401 });
    }

    // 2. Parse and Validate Payload
    const body = await req.json();
    const { theater, payload, productId } = body;

    if (!['theater_1', 'theater_3'].includes(theater)) {
      return NextResponse.json({ error: 'Invalid Industrial Theater' }, { status: 400 });
    }

    // 3. Process Industrial State
    const { parsedState, stateHash, timestamp } = await processIndustrialEvent(
      theater as IndustrialTheater, 
      payload
    );

    // 4. Trigger Blockchain Anchoring (Async)
    // We don't block the ingestion for anchoring success
    let anchoredTxHash: string | undefined;
    try {
      const anchorResult = await anchorEdgeHash(stateHash, `${theater}:${parsedState.identity}`);
      anchoredTxHash = anchorResult.txHash;
      console.log(`[Industrial] Anchored ${theater} state: ${anchoredTxHash}`);
    } catch (anchorErr) {
      const msg = anchorErr instanceof Error ? anchorErr.message : String(anchorErr);
      console.error(`[Industrial] Anchoring failed for ${theater}:`, anchorErr);
      await logAutomation('industrial_telemetry.anchor', 'event', 'failure', { theater, userId, productId, stateHash }, msg);
    }

    // 5. Store Telemetry Event
    const { data: event, error: dbError } = await admin
      .from('telemetry_events')
      .insert({
        user_id: userId,
        theater,
        product_id: productId || null,
        raw_payload: payload,
        parsed_state: parsedState,
        state_hash: stateHash,
        anchored_tx_hash: anchoredTxHash || null,
        timestamp: timestamp
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      eventId: event.id,
      stateHash,
      anchored: !!anchoredTxHash,
      txHash: anchoredTxHash
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Industrial/Telemetry] Ingestion error:', err);
    await logAutomation('industrial_telemetry', 'event', 'failure', null, msg);
    return NextResponse.json({
      error: 'Ingestion pipeline failure',
      detail: msg
    }, { status: 500 });
  }
}
