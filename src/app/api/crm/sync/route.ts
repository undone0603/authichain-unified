import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * CRM SYNC HANDLER (HubSpot)
 * Part of the "Real Contacts for CRM" solution.
 */

const HUBSPOT_API_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

export async function POST(req: NextRequest) {
  // Initialize Supabase inside the handler to avoid build-time env var errors
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[CRM-Sync] Supabase env vars missing');
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const HUBSPOT_API_KEY = process.env.HUBSPOT_ACCESS_TOKEN;

  try {
    const { email, first_name, last_name, company_name, job_title, lead_score } = await req.json();

    if (!HUBSPOT_API_KEY) {
      console.warn('[CRM-Sync] HUBSPOT_ACCESS_TOKEN missing');
      return NextResponse.json({ error: 'CRM not configured' }, { status: 503 });
    }

    console.log(`[CRM-Sync] Syncing high-value lead to HubSpot: ${email} (score: ${lead_score})`);

    // Upsert contact in HubSpot
    const hubspotRes = await fetch(HUBSPOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname: first_name,
          lastname: last_name,
          company: company_name,
          jobtitle: job_title,
          hs_lead_status: lead_score >= 80 ? 'IN_PROGRESS' : 'NEW',
        },
      }),
    });

    if (!hubspotRes.ok) {
      const errText = await hubspotRes.text();
      console.error('[CRM-Sync] HubSpot error:', errText);
      return NextResponse.json({ error: 'HubSpot sync failed', details: errText }, { status: 502 });
    }

    const hubspotData = await hubspotRes.json();

    // Log sync to Supabase
    await admin.from('crm_sync_log').insert({
      email,
      first_name,
      last_name,
      company_name,
      job_title,
      lead_score,
      hubspot_id: hubspotData.id,
      synced_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, hubspot_id: hubspotData.id });
  } catch (error) {
    console.error('[CRM-Sync] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
