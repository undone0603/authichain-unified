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

// Cache for 1 hour to avoid repeated DB calls on landing page
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 3600000;

export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const [usersRes, qronsRes, scansRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('qrons').select('id', { count: 'exact', head: true }),
      supabase.from('usage_stats').select('total_scans'),
    ]);

    const totalUsers = usersRes.count || 0;
    const totalQrons = qronsRes.count || 0;
    const totalScans = (scansRes.data || []).reduce((sum: number, r: any) => sum + (r.total_scans || 0), 0);

    // Pad with realistic minimums if DB is empty (early traction)
    const stats = {
      total_users: totalUsers,
      total_qrons: totalQrons,
      total_scans: totalScans,
    };

    const proof = {
      stats,
      trust_badges: [
        { label: 'Stripe Secured', icon: 'stripe' },
        { label: 'GDPR Compliant', icon: 'gdpr' },
      ],
      generated_at: new Date().toISOString(),
    };

    cache = { data: proof, ts: Date.now() };
    return NextResponse.json(proof);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
