import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { onVerificationEvent } from '../../../../server/revenue-engine/loop';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { seal_id, scan_context } = await req.json();

    if (!seal_id) {
      return NextResponse.json({ error: 'seal_id is required' }, { status: 400 });
    }

    // 1. Fetch the seal record
    const { data: seal, error: fetchError } = await supabase
      .from('auth_seals')
      .select('*')
      .eq('id', seal_id)
      .single();

    if (fetchError || !seal) {
      await onVerificationEvent({
        seal_id,
        brand: scan_context?.brand ?? 'authichain.com',
        scan_context: scan_context ?? {},
        status: 'invalid',
      });
      return NextResponse.json({ status: 'invalid', details: { reason: 'seal_not_found' } });
    }

    // 2. Optionally validate chain anchor (non-blocking)
    let chain_valid = true;
    if (seal.polygon_tx) {
      try {
        const chainRes = await fetch(`${process.env.WORKER_URL ?? ''}/chain-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.WORKER_API_KEY ?? '' },
          body: JSON.stringify({ seal_id, polygon_tx: seal.polygon_tx }),
        });
        if (chainRes.ok) {
          const chainData = await chainRes.json() as { valid?: boolean };
          chain_valid = chainData.valid !== false;
        }
      } catch {
        // Non-fatal: chain anchor check failed, treat as valid
      }
    }

    const status: 'valid' | 'invalid' = chain_valid ? 'valid' : 'invalid';

    // 3. Fire revenue engine event
    await onVerificationEvent({
      seal_id,
      brand: seal.brand,
      scan_context: scan_context ?? {},
      status,
    });

    return NextResponse.json({
      status,
      details: {
        product_id: seal.product_id,
        batch_id: seal.batch_id,
        brand: seal.brand,
        created_at: seal.created_at,
        polygon_tx: seal.polygon_tx,
      },
    });
  } catch (err) {
    console.error('[verify] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
