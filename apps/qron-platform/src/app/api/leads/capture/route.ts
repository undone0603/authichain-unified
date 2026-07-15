import { NextRequest, NextResponse } from 'next/server';
import { handleLeadAutomation, logAutomation } from '@/lib/automation';

export const dynamic = 'force-dynamic';

interface LeadData {
  email: string;
  name?: string;
  source?: string;
  page_url?: string;
  product_interest?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: LeadData = await req.json();
    if (!body.email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // 1. Sync to Supabase
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const admin = createClient(supabaseUrl, serviceKey);

      await admin.from('lead_captures').insert({
        email: body.email,
        name: body.name || null,
        source: body.source || 'website',
        page_url: body.page_url || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        product_interest: body.product_interest || 'qron',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[lead-capture] DB error:', err);
      await logAutomation('lead_capture.db_insert', 'event', 'failure', { email: body.email, source: body.source }, msg);
    }

    // 2. Trigger Automation (HubSpot, Make.com, Email)
    await handleLeadAutomation({
      email: body.email,
      name: body.name,
      source: body.source,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[lead-capture] Error:', err);
    await logAutomation('lead_capture', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
