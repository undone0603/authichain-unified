export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/supabase/require-admin';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Lead Pipeline Funnel
    const { data: allLeads } = await admin
      .from('lead_captures')
      .select('id, status, product_interest, score, created_at, updated_at, email');

    const leads = allLeads || [];

    const pipeline = {
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      demoed: leads.filter(l => l.status === 'demoed').length,
      contracted: leads.filter(l => l.status === 'contracted').length,
      signed: leads.filter(l => l.status === 'signed').length,
      converted: leads.filter(l => l.status === 'converted').length,
    };

    const total_leads = leads.length;
    const conversion_rate = total_leads > 0
      ? ((pipeline.converted / total_leads) * 100).toFixed(1)
      : '0';

    // Domain Performance
    const domains = ['qron', 'authichain', 'govchain', 'strainchain'];
    const domainMetrics = domains.map(domain => {
      const domainLeads = leads.filter(l => (l.product_interest || '').toLowerCase() === domain.toLowerCase());
      const converted = domainLeads.filter(l => l.status === 'converted').length;
      const convRate = domainLeads.length > 0 ? ((converted / domainLeads.length) * 100).toFixed(1) : '0';
      return {
        domain,
        total: domainLeads.length,
        converted,
        conversion_rate: convRate,
        avg_score: domainLeads.length > 0
          ? (domainLeads.reduce((acc, l) => acc + (l.score || 0), 0) / domainLeads.length).toFixed(1)
          : '0',
      };
    });

    // Revenue impact (estimated)
    const avgDealValue = 5000; // $5k per deal assumption
    const estimatedRevenue = (pipeline.converted * avgDealValue).toLocaleString();

    // Recent engagement events
    const { data: logs } = await admin
      .from('automation_logs')
      .select('id, workflow_name, status, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(10);

    // Top scoring leads (high intent)
    const topLeads = leads
      .filter(l => l.status !== 'converted')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map(l => ({
        email: l.email,
        score: l.score,
        status: l.status,
        domain: l.product_interest,
      }));

    // Autonomous system health — last 24h agent activity
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: automationCount24h } = await admin
      .from('automation_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    const { data: workflowBreakdown } = await admin
      .from('automation_logs')
      .select('workflow_name')
      .gte('created_at', oneDayAgo);

    const workflowCounts: Record<string, number> = {};
    for (const row of workflowBreakdown || []) {
      workflowCounts[row.workflow_name] = (workflowCounts[row.workflow_name] || 0) + 1;
    }

    // Pipeline velocity — leads created in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newLeads7d = leads.filter(l => l.created_at && l.created_at >= sevenDaysAgo).length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        total_leads,
        total_converted: pipeline.converted,
        conversion_rate: `${conversion_rate}%`,
        estimated_revenue: `$${estimatedRevenue}`,
        avg_lead_score: (leads.reduce((acc, l) => acc + (l.score || 0), 0) / Math.max(1, leads.length)).toFixed(1),
        leads_last_7d: newLeads7d,
      },
      pipeline,
      domain_metrics: domainMetrics,
      autonomous_health: {
        actions_24h: automationCount24h || 0,
        workflow_breakdown: workflowCounts,
      },
      recent_events: logs?.map(l => ({
        workflow: l.workflow_name,
        status: l.status,
        timestamp: l.created_at,
        payload: l.payload,
      })) || [],
      high_intent_leads: topLeads,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
