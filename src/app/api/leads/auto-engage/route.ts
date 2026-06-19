export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LeadData {
  email: string;
  name?: string;
  company?: string;
  domain: 'qron' | 'authichain' | 'govchain' | 'strainchain';
  source?: string;
  metadata?: Record<string, any>;
}

const DOMAIN_CONFIG = {
  qron: {
    name: 'QRON.space',
    value_prop: 'AI-powered creative QR codes with vision markers',
    intro_email: 'Welcome to QRON.space — Generate AI art inside QR codes',
  },
  authichain: {
    name: 'AuthiChain.com',
    value_prop: 'Digital credential issuance & authentication',
    intro_email: 'AuthiChain: Secure digital credentials for your business',
  },
  govchain: {
    name: 'GovChain.us',
    value_prop: 'Government-grade governance & DAO rewards',
    intro_email: 'GovChain.us — Governance infrastructure for DAOs',
  },
  strainchain: {
    name: 'StrainChain.io',
    value_prop: 'Industrial provenance & supply chain tracking',
    intro_email: 'StrainChain.io — Full supply chain visibility',
  },
};

function calculateLeadScore(lead: LeadData): number {
  let score = 0;

  if (lead.company) score += 20;
  if (lead.name?.split(' ').length > 1) score += 10;
  if (lead.source === 'organic') score += 15;
  if (lead.source === 'inbound') score += 25;
  if (lead.metadata?.from_webinar) score += 30;
  if (lead.metadata?.has_budget) score += 40;
  if (lead.metadata?.decision_maker) score += 35;

  const emailDomain = lead.email.split('@')[1];
  if (emailDomain && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(emailDomain)) {
    score += 20;
  }

  return Math.min(score, 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadData;
    const { email, name, company, domain, source = 'api', metadata = {} } = body;

    if (!email || !domain) {
      return NextResponse.json({ error: 'Email and domain required' }, { status: 400 });
    }

    if (!Object.keys(DOMAIN_CONFIG).includes(domain)) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
    }

    const score = calculateLeadScore(body);

    const { data: existing } = await admin
      .from('lead_captures')
      .select('id')
      .eq('email', email)
      .eq('product_interest', domain)
      .single();

    if (existing) {
      return NextResponse.json({ id: existing.id, message: 'Lead already exists', score }, { status: 200 });
    }

    const config = DOMAIN_CONFIG[domain];
    const { data: lead, error } = await admin
      .from('lead_captures')
      .insert({
        email,
        name: name || 'Prospect',
        company: company || null,
        product_interest: domain,
        source,
        status: score >= 70 ? 'qualified' : 'new',
        score,
        metadata: {
          ...metadata,
          captured_at: new Date().toISOString(),
          domain_name: config.name,
          initial_score: score,
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    if (lead && score >= 70) {
      await admin.from('automation_logs').insert({
        workflow_name: 'lead_capture_high_score',
        status: 'completed',
        payload: {
          lead_id: lead.id,
          email,
          score,
          domain,
        },
      });
    }

    return NextResponse.json({
      id: lead?.id,
      email,
      domain,
      score,
      status: score >= 70 ? 'qualified' : 'new',
      next_action: score >= 70 ? 'Send intro email within 2 hours' : 'Nurture track',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
