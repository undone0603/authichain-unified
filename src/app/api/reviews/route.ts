import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const platform = searchParams.get('platform'); // 'g2', 'product_hunt', 'capterra', 'internal'
    const minRating = parseFloat(searchParams.get('min_rating') || '4');
    const featured = searchParams.get('featured') === 'true';

    let query = supabase
      .from('product_reviews')
      .select('id, author_name, author_company, author_role, platform, rating, title, content, verified, is_featured, created_at, source_url')
      .gte('rating', minRating)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (platform) query = query.eq('platform', platform);
    if (featured) query = query.eq('is_featured', true);

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate stats
    const { data: stats } = await supabase
      .from('product_reviews')
      .select('rating, platform')
      .eq('is_published', true);

    const allRatings = (stats || []).map((r: any) => r.rating);
    const avgRating = allRatings.length > 0
      ? (allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length).toFixed(1)
      : '5.0';

    const platformCounts = (stats || []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      reviews: data || [],
      stats: {
        total_reviews: allRatings.length,
        average_rating: avgRating,
        by_platform: platformCounts,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { author_name, author_company, author_role, rating, title, content } = body;
    if (!author_name || !rating || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase.from('product_reviews').insert({
      user_id: user.id,
      author_name,
      author_company: author_company || null,
      author_role: author_role || null,
      platform: 'internal',
      rating: Math.min(5, Math.max(1, parseInt(rating))),
      title: title || null,
      content,
      verified: true,
      is_featured: false,
      is_published: false, // requires review
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      review: data,
      message: 'Review submitted! It will appear after moderation.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
