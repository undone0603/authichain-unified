import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { onDispensaryScan } from '../../../../server/revenue-engine/loop';
import { onDispensaryBatchCreated } from '../../../../server/crm/events';

export async function POST(req: NextRequest) {
  try {
    const { dispensary_id, batch_id, events, brand } = await req.json();
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    if (!dispensary_id || !batch_id) {
      return NextResponse.json({ error: 'dispensary_id and batch_id are required' }, { status: 400 });
    }

    const resolved_brand = brand ?? 'strainchain.io';

    // 1. Generate QR for batch
    const payload_raw = JSON.stringify({ dispensary_id, batch_id, resolved_brand, ts: Date.now() });
    const qr_hash = createHash('sha256').update(payload_raw).digest('hex');
    const qr_payload = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://strainchain.io'}/provenance?batch=${batch_id}&hash=${qr_hash}`;

    // 2. Insert provenance_batches row
    const { error: dbError } = await supabase.from('provenance_batches').insert({
      id: randomUUID(),
      dispensary_id,
      batch_id,
      brand: resolved_brand,
      qr_payload,
      events: events ?? [],
    });

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create provenance batch' }, { status: 500 });
    }

    // 3. Fire revenue engine + CRM
    await onDispensaryScan({
      dispensary_id,
      batch_id,
      brand: resolved_brand,
      scan_context: {},
    });

    await onDispensaryBatchCreated({
      brand: resolved_brand,
      dispensary_id,
      batch_id,
    });

    return NextResponse.json({ batch_id, qr_url: qr_payload });
  } catch (err) {
    console.error('[provenance] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
