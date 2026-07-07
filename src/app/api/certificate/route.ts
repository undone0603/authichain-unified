import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { onCertificateMint } from '../../../../server/revenue-engine/loop';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}
/** Simple rarity score: 0-100 based on seal age + input entropy */
function computeRarity(rarity_input: unknown): number {
  const entropy = JSON.stringify(rarity_input ?? {}).length;
  return Math.min(100, Math.round((entropy / 200) * 100));
}

export async function POST(req: NextRequest) {
  try {
    const { product_id, seal_id, rarity_input, brand } = await req.json();

    if (!product_id || !seal_id || !brand) {
      return NextResponse.json({ error: 'product_id, seal_id, and brand are required' }, { status: 400 });
    }

    const rarity_score = computeRarity(rarity_input);
    const certificate_id = randomUUID();

    // 1. Mint NFT on Polygon via Worker
    let polygon_nft_tx: string | null = null;
    try {
      const mintRes = await fetch(`${process.env.WORKER_URL ?? ''}/mint-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.WORKER_API_KEY ?? '' },
        body: JSON.stringify({ certificate_id, product_id, seal_id, rarity_score, brand }),
      });
      if (mintRes.ok) {
        const mintData = await mintRes.json() as { tx?: string };
        polygon_nft_tx = mintData.tx ?? null;
      }
    } catch (mintErr) {
      console.warn('[certificate] NFT mint failed (non-fatal):', mintErr);
    }

    // 2. Insert certificate row
    const { error: dbError } = await supabase.from('certificates').insert({
      id: certificate_id,
      product_id,
      seal_id,
      rarity_score,
      polygon_nft_tx,
      brand,
    });

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 });
    }

    // 3. Fire revenue engine
    await onCertificateMint({
      certificate_id,
      product_id,
      seal_id,
      rarity_score,
      polygon_nft_tx: polygon_nft_tx ?? '',
      brand,
    });

    return NextResponse.json({ certificate_id, nft_tx: polygon_nft_tx });
  } catch (err) {
    console.error('[certificate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
