import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Build-time-safe fallback: Next.js imports every route module during
// production build's page-data collection, which runs before real env
// vars are available in some environments. A placeholder here only
// matters at build time -- real requests always have real env vars.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key"
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const plan = searchParams.get('plan');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query = supabase
      .from('testimonials')
      .select('id, name, role, company, avatar_initials, rating, text, plan, verified, created_at')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (plan) query.eq('plan', plan);

    const { data, error } = await query;

    const testimonials = data ?? [];

    return NextResponse.json({ testimonials, count: testimonials.length });
  } catch (err) {
    return NextResponse.json({ testimonials: [], count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { text, rating, role, company } = await req.json();
    if (!text || !rating) return NextResponse.json({ error: 'text and rating are required' }, { status: 400 });

    const { data, error } = await supabase.from('testimonials').insert({
      user_id: user.id,
      text,
      rating: Math.min(5, Math.max(1, rating)),
      role: role || null,
      company: company || null,
      approved: false,
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, testimonial: data, message: 'Thank you! Your testimonial is under review.' });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
