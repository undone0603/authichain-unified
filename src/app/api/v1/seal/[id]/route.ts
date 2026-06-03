import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * AuthiChain Live Truth Seal API
 * GET /api/v1/seal/[id]
 * 
 * Returns lightweight verification status for embeddable seals.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, brand, authenticity_score, is_registered, updated_at')
    .eq('id', productId)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Basic CORS for public embeds
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=300'
  };

  const status = (product.authenticity_score || 0) >= 90 ? 'VERIFIED' : 'SUSPECT';
  
  return NextResponse.json({
    productId: product.id,
    brand: product.brand,
    status,
    score: product.authenticity_score,
    timestamp: product.updated_at,
    sealUrl: `https://authichain.com/p/SERIAL-${product.id}`, // Placeholder serial logic
    protocol: "AuthiChain v2.4"
  }, { headers });
}
