/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * 
 * Centralized aggregator for ecosystem-wide performance metrics.
 */
export async function GET(_request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Ecosystem Adoption (Scans & QRONs)
    const { data: qrons } = await supabase.from('qrons').select('scan_count');
    const totalScans = (qrons || []).reduce((acc, q) => acc + (q.scan_count || 0), 0);
    const totalQrons = qrons?.length || 0;

    // 2. Industrial Activity (StrainChain)
    const { count: certCount } = await supabase
      .from('certifications')
      .select('*', { count: 'exact', head: true });
    
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // 3. Governance & Economy (GovChain / AuthiChain)
    const { data: brands } = await supabase.from('brands').select('qron_staked, staking_tier');
    const totalStaked = (brands || []).reduce((acc, b) => acc + parseFloat(b.qron_staked || '0'), 0);

    const { data: fees } = await supabase.from('fee_flows').select('burn_amount, net_amount');
    const totalBurned = (fees || []).reduce((acc, f) => acc + parseFloat(f.burn_amount || '0'), 0);

    // 4. Lead Pipeline
    const { count: leadCount } = await supabase
      .from('lead_captures')
      .select('*', { count: 'exact', head: true });

    // 5. Recent Autonomous Activity
    const { data: logs } = await supabase
      .from('automation_logs')
      .select('created_at, workflow_name, status, payload')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      creative: {
        total_qrons: totalQrons,
        total_scans: totalScans,
      },
      industrial: {
        total_products: productCount || 0,
        total_certifications: certCount || 0,
      },
      governance: {
        total_staked_qron: totalStaked,
        total_burned_qron: totalBurned,
        active_brands: brands?.length || 0,
      },
      pipeline: {
        total_leads: leadCount || 0,
      },
      recent_logs: logs || []
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
