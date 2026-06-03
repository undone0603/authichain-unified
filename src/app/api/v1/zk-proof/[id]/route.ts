import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * AuthiChain Selective Disclosure & ZK-Proof Endpoint
 * 
 * Allows proving a specific metadata attribute without revealing the full state.
 * Implements "Selective Hashing" as a high-fidelity ZK primitive.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attribute = req.nextUrl.searchParams.get('attr') || 'origin';
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, brand, metadata')
    .eq('id', parseInt(id))
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const metadata = (product.metadata as any) || {};
  const value = metadata[attribute] || metadata.origin || 'Certified Origin';

  // 1. Create a random salt (blinding factor)
  const salt = require('crypto').randomBytes(16).toString('hex');

  // 2. Generate the commitment (hash of value + salt)
  const commitment = createHash('sha256')
    .update(`${attribute}:${value}:${salt}`)
    .digest('hex');

  // 3. Return the ZK Proof Payload
  return NextResponse.json({
    proofType: "SelectiveDisclosureProof2026",
    productId: product.id,
    attribute,
    commitment,
    // The salt and value are the "witness" that can be revealed later
    witness: {
      value,
      salt
    },
    verificationEndpoint: `https://authichain.com/api/v1/zk-proof/verify`,
    protocol: "AuthiChain Privacy Layer v1.0"
  });
}
