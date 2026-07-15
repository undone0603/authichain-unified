import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, plan, status, created_at, trial_ends_at')
      .in('status', ['active', 'trialing']);
    if (error) throw error;

    const scored: { userId: string; plan: string; riskScore: number; riskLevel: string; signals: string[] }[] = [];

    for (const sub of subscriptions ?? []) {
      let score = 0;
      const signals: string[] = [];

      const { count: recentScans } = await supabase
        .from('qr_scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', sub.user_id)
        .gte('scanned_at', sevenDaysAgo);
      if ((recentScans ?? 0) === 0) { score += 30; signals.push('No QR scans in 7 days'); }

      const { count: totalScans } = await supabase
        .from('qr_scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', sub.user_id)
        .gte('scanned_at', thirtyDaysAgo);
      if ((totalScans ?? 0) === 0) { score += 20; signals.push('No QR scans in 30 days'); }

      const accountAge = Date.now() - new Date(sub.created_at).getTime();
      if (sub.plan === 'free' && accountAge > 14 * 24 * 60 * 60 * 1000) {
        score += 20; signals.push('Free plan 14+ days');
      }

      if (sub.status === 'trialing' && sub.trial_ends_at) {
        const daysLeft = (new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysLeft <= 3 && daysLeft > 0) { score += 30; signals.push('Trial ending within 3 days'); }
      }

      const riskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

      await supabase.from('churn_risk_scores').upsert({
        user_id: sub.user_id, subscription_id: sub.id,
        score, risk_level: riskLevel, signals,
        evaluated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      scored.push({ userId: sub.user_id, plan: sub.plan, riskScore: score, riskLevel, signals });
    }

    return NextResponse.json({
      success: true,
      total: scored.length,
      highRisk: scored.filter(s => s.riskLevel === 'high').length,
      mediumRisk: scored.filter(s => s.riskLevel === 'medium').length,
      users: scored.sort((a, b) => b.riskScore - a.riskScore),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
