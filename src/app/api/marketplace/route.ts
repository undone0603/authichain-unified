import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/marketplace - Browse QRON AI art marketplace listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const style = searchParams.get('style');
    const sort = searchParams.get('sort') || 'featured';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Featured AI art styles available in the marketplace
    const styles = [
      'cyberpunk', 'watercolor', 'geometric', 'neon', 'minimalist',
      'retro', 'nature', 'space', 'abstract', 'photorealistic'
    ];

    const listings = Array.from({ length: limit }, (_, i) => ({
      id: `MKTPL-${(page - 1) * limit + i + 1}`,
      title: `AI QR Art #${(page - 1) * limit + i + 1}`,
      style: style || styles[i % styles.length],
      creator: `creator_${Math.floor(Math.random() * 1000)}`,
      price: parseFloat((0.01 + Math.random() * 0.5).toFixed(4)),
      currency: 'ETH',
      scans: Math.floor(Math.random() * 10000),
      nft_minted: Math.random() > 0.5,
      chain: 'Polygon',
      preview_url: `https://qron.space/art/${(page - 1) * limit + i + 1}.png`,
      tags: [style || styles[i % styles.length], 'qr-art', 'ai-generated'],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600000).toISOString(),
      featured: i < 3
    }));

    return NextResponse.json({
      success: true,
      total: 10000,
      page,
      limit,
      pages: Math.ceil(10000 / limit),
      sort,
      style_filter: style,
      available_styles: styles,
      listings
    });
  } catch (error) {
    console.error('Marketplace GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/marketplace - List a QRON as marketplace item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { qron_id, price, currency = 'ETH', description } = body;

    if (!qron_id || !price) {
      return NextResponse.json(
        { error: 'qron_id and price are required' },
        { status: 400 }
      );
    }

    const listing_id = `MKTPL-${Date.now()}`;

    return NextResponse.json({
      success: true,
      listing_id,
      qron_id,
      seller: user.id,
      price,
      currency,
      description,
      status: 'active',
      listed_at: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Marketplace POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
