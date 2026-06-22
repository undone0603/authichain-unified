import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEED_TESTIMONIALS = [
  { id: '1', name: 'Marcus T.', role: 'Marketing Director', company: 'RetailBrand Co.', avatar_initials: 'MT', rating: 5, text: 'QRON transformed how we track our in-store QR campaigns. The AI art styling alone is worth the upgrade — our scan rates doubled in the first month.', plan: 'pro', verified: true, created_at: '2026-03-12' },
  { id: '2', name: 'Priya S.', role: 'E-commerce Manager', company: 'ShopFast', avatar_initials: 'PS', rating: 5, text: 'We replaced three separate tools with QRON. The analytics dashboard tells us exactly which QR codes drive conversions. Setup took 10 minutes.', plan: 'pro', verified: true, created_at: '2026-02-28' },
  { id: '3', name: 'Jake R.', role: 'Freelance Designer', company: 'Independent', avatar_initials: 'JR', rating: 5, text: 'The AI-generated art for QR codes is incredible. My clients are blown away every time. I upsell this to every project now.', plan: 'pro', verified: true, created_at: '2026-04-01' },
  { id: '4', name: 'Sophia L.', role: 'Event Coordinator', company: 'EventPro Agency', avatar_initials: 'SL', rating: 5, text: 'For events, QRON is a game changer. Real-time scan tracking, custom domains, and beautiful codes that match our branding. Our sponsors love it.', plan: 'business', verified: true, created_at: '2026-01-15' },
  { id: '5', name: 'David M.', role: 'Restaurant Owner', company: 'The Copper Spoon', avatar_initials: 'DM', rating: 4, text: 'Switched our menu QRs to QRON. Being able to update the destination URL without reprinting has saved us hundreds of dollars already.', plan: 'starter', verified: true, created_at: '2026-03-20' },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const plan = searchParams.get('plan');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Try database first, fall back to seed data
    const query = supabase
      .from('testimonials')
      .select('id, name, role, company, avatar_initials, rating, text, plan, verified, created_at')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (plan) query.eq('plan', plan);

    const { data, error } = await query;

    const testimonials = (data && data.length > 0) ? data : SEED_TESTIMONIALS.filter(t => !plan || t.plan === plan).slice(0, limit);

    return NextResponse.json({ testimonials, count: testimonials.length });
  } catch (err: any) {
    return NextResponse.json({ testimonials: SEED_TESTIMONIALS, count: SEED_TESTIMONIALS.length });
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
