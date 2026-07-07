import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const { product_id, batch_id, brand, metadata } = await req.json();
    if (!product_id || !brand) {
      return NextResponse.json({ error: 'product_id and brand are required' }, { status: 400 });
    }

    // 1. Generate tamper-evident QR payload (hash of product_id + batch_id + timestamp)
    const seal_id = randomUUID();
    const timestamp = new Date().toISOString();
    const payload_raw = JSON.stringify({ seal_id, product_id, batch_id, brand, metadata, timestamp });
    const qr_hash = createHash('sha256').update(payload_raw).digest('hex');
    const qr_payload = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://authichain.com'}/verify?seal=${seal_id}&hash=${qr_hash}`;

    // 2. Anchor hash to Polygon via existing Alchemy RPC (non-blocking)
    let polygon_tx: string | null = null;
    try {
      const anchorRes = await fetch(`${process.env.WORKER_URL ?? ''}/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.WORKER_API_KEY ?? '' },
        body: JSON.stringify({ seal_id, hash: qr_hash, brand }),
      });
      if (anchorRes.ok) {
        const anchorData = await anchorRes.json() as { tx?: string };
        polygon_tx = anchorData.tx ?? null;
      }
    } catch (anchorErr) {
      console.warn('[seal] Polygon anchor failed (non-fatal):', anchorErr);
    }

    // 3. Insert auth_seals row
    const { error: dbError } = await supabase.from('auth_seals').insert({
      id: seal_id,
      product_id,
      batch_id: batch_id ?? null,
      brand,
      qr_payload,
      polygon_tx,
    });

    if (dbError) {
      console.error('[seal] Supabase insert failed:', dbError);
      return NextResponse.json({ error: 'Failed to create seal' }, { status: 500 });
    }

    return NextResponse.json({ seal_id, qr_url: qr_payload });
  } catch (err) {
    console.error('[seal] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
