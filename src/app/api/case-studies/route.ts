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
    const slug = searchParams.get('slug');
    const industry = searchParams.get('industry');
    const limit = parseInt(searchParams.get('limit') || '10');
    const featured = searchParams.get('featured') === 'true';

    if (slug) {
      // Single case study by slug
      const { data, error } = await supabase
        .from('case_studies')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error || !data) return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
      return NextResponse.json({ success: true, case_study: data });
    }

    // List case studies
    let query = supabase
      .from('case_studies')
      .select('id, slug, title, company_name, company_logo, industry, summary, qr_codes_generated, scan_increase_percent, roi_multiplier, is_featured, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (industry) query = query.eq('industry', industry);
    if (featured) query = query.eq('is_featured', true);

    const { data, error } = await query;
    if (error) throw error;

    // Get distinct industries for filters
    const { data: industries } = await supabase
      .from('case_studies')
      .select('industry')
      .eq('is_published', true);

    const uniqueIndustries = [...new Set((industries || []).map((i: any) => i.industry).filter(Boolean))];

    return NextResponse.json({
      success: true,
      case_studies: data || [],
      industries: uniqueIndustries,
      total: data?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
