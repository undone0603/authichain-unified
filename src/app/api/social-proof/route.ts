import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

interface UsageStatRow {
  total_scans?: number | null;
}

interface SocialProofResponse {
  stats: {
    total_users: number;
    total_qrons: number;
    total_scans: number;
  };
  trust_badges: Array<{ label: string; icon: string }>;
  generated_at: string;
}

// Cache for 1 hour to avoid repeated DB calls on landing page
let cache: { data: SocialProofResponse; ts: number } | null = null;
const CACHE_TTL = 3600000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET(_req: NextRequest) {
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
    const scanRows = (scansRes.data ?? []) as UsageStatRow[];
    const totalScans = scanRows.reduce((sum, row) => sum + (row.total_scans || 0), 0);

    // Real counts only. Do not floor these to invented minimums and do not add
    // hardcoded ratings, review counts, or country totals — an authenticity
    // product cannot publish unverifiable numbers about itself. If a figure is
    // not measured from the ledger, it does not belong in this response.
    const stats = {
      total_users: totalUsers,
      total_qrons: totalQrons,
      total_scans: totalScans,
    };

    const proof: SocialProofResponse = {
      stats,
      // Only badges backed by something checkable. SOC 2 was removed: no report
      // exists. Uptime was removed: no measured figure is read here.
      trust_badges: [
        { label: 'Stripe Secured', icon: 'stripe' },
        { label: 'GDPR Compliant', icon: 'gdpr' },
      ],
      generated_at: new Date().toISOString(),
    };

    cache = { data: proof, ts: Date.now() };
    return NextResponse.json(proof);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
