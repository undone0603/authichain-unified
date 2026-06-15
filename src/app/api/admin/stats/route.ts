export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Centralized aggregator for ecosystem-wide performance metrics.
 * Requires: authenticated session + admin role in profiles.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/utils/supabase/require-admin';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createClient();

    const { data: qrons } = await supabase.from('qrons').select('scan_count');
    const totalScans = (qrons || []).reduce((acc, q) => acc + (q.scan_count || 0), 0);
    const totalQrons = qrons?.length || 0;

    const { count: certCount } = await supabase
      .from('certifications')
      .select('*', { count: 'exact', head: true });

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { data: brands } = await supabase.from('brands').select('qron_staked, staking_tier');
    const totalStaked = (brands || []).reduce((acc, b) => acc + parseFloat(b.qron_staked || '0'), 0);

    const { data: fees } = await supabase.from('fee_flows').select('burn_amount, net_amount');
    const totalBurned = (fees || []).reduce((acc, f) => acc + parseFloat(f.burn_amount || '0'), 0);

    const { count: leadCount } = await supabase
      .from('lead_captures')
      .select('*', { count: 'exact', head: true });

    const { data: logs } = await supabase
      .from('automation_logs')
      .select('created_at, workflow_name, status, payload')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      creative:   { total_qrons: totalQrons, total_scans: totalScans },
      industrial: { total_products: productCount || 0, total_certifications: certCount || 0 },
      governance: { total_staked_qron: totalStaked, total_burned_qron: totalBurned, active_brands: brands?.length || 0 },
      pipeline:   { total_leads: leadCount || 0 },
      recent_logs: logs || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
