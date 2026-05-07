import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * CRM SYNC HANDLER (HubSpot)
 * Part of the "Real Contacts for CRM" solution.
 */

const HUBSPOT_API_KEY = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_API_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

export async function POST(req: NextRequest) {
  try {
    const { email, first_name, last_name, company_name, job_title, lead_score } = await req.json();

    if (!HUBSPOT_API_KEY) {
      console.warn('[CRM-Sync] HUBSPOT_ACCESS_TOKEN missing');
      return NextResponse.json({ error: 'CRM not configured' }, { status: 503 });
    }

    console.log(`[CRM-Sync] Syncing high-value lead to HubSpot: ${email} (Score: ${lead_score})`);

    // 1. Prepare HubSpot CRM Payload
    const payload = {
      properties: {
        email: email,
        firstname: first_name || 'Protocol',
        lastname: last_name || 'Lead',
        company: company_name || 'Unknown Enterprise',
        jobtitle: job_title || '',
        hs_lead_status: lead_score > 70 ? 'OPEN' : 'NEW',
        lead_score: lead_score.toString()
      }
    };

    // 2. Execute Sync
    const res = await fetch(HUBSPOT_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      // If contact exists (409), we could handle an update, but for now we log it.
      if (res.status === 409) {
          console.log(`[CRM-Sync] Contact already exists in HubSpot: ${email}`);
          return NextResponse.json({ success: true, message: 'Contact already exists' });
      }
      throw new Error(`HubSpot API Error: ${res.status} - ${errText}`);
    }

    const data = await res.json();

    // 3. Log Success to Supabase
    await admin.from('automation_logs').insert({
      workflow_name: 'hubspot_sync',
      trigger_type: 'event',
      status: 'success',
      payload: JSON.stringify({ email, contact_id: data.id })
    });

    return NextResponse.json({ success: true, contact_id: data.id });

  } catch (err: unknown) {
    console.error('[CRM-Sync] Critical Failure:', err);
    return NextResponse.json({ 
      error: 'HubSpot synchronization failed',
      detail: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

/**
 * GET handler for Vercel Cron invocation
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Trigger batch CRM cleanup or sync
  console.log('[CRM-Sync] Vercel Cron: Initiating batch sync cycle...');
  
  return NextResponse.json({ status: 'Batch cycle initiated' });
}
