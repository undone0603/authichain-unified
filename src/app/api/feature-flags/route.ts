import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_FLAGS: Record<string, { plans: string[]; description: string }> = {
  ai_qr_styles: { plans: ['pro', 'enterprise'], description: 'AI-generated QR code art styles' },
  bulk_qr_export: { plans: ['starter', 'pro', 'enterprise'], description: 'Export multiple QR codes at once' },
  custom_domains: { plans: ['starter', 'pro', 'enterprise'], description: 'Custom redirect domains' },
  advanced_analytics: { plans: ['pro', 'enterprise'], description: 'Scan heatmaps, device breakdown, UTM tracking' },
  team_members: { plans: ['pro', 'enterprise'], description: 'Invite team members to your workspace' },
  api_access: { plans: ['pro', 'enterprise'], description: 'Programmatic QR code creation via API' },
  white_label: { plans: ['enterprise'], description: 'Remove QRON branding from QR codes' },
  sso: { plans: ['enterprise'], description: 'Single sign-on via SAML/OIDC' },
  priority_support: { plans: ['pro', 'enterprise'], description: 'Priority email and chat support' },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ flags: DEFAULT_FLAGS });
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user_id)
    .single();

  const plan = sub?.plan || 'free';
  const isActive = !sub || sub.status === 'active' || sub.status === 'trialing';

  const userFlags: Record<string, boolean> = {};
  for (const [flag, config] of Object.entries(DEFAULT_FLAGS)) {
    userFlags[flag] = isActive && config.plans.includes(plan);
  }

  return NextResponse.json({
    plan,
    status: sub?.status || 'free',
    flags: userFlags,
  });
}
