import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * CRM SYNC HANDLER (Pipeline CRM)
 * Part of the "Real Contacts for CRM" solution.
 * Refined from Z-kie/AuthiChain repository logic.
 */

const PIPELINE_API_KEY = process.env.PIPELINE_CRM_API_KEY;
const PIPELINE_API_URL = "https://api.pipelinedeals.com/api/v3/people";

export async function POST(req: NextRequest) {
  try {
    const { email, first_name, last_name, company_name, job_title, lead_score } = await req.json();

    if (!PIPELINE_API_KEY) {
      console.warn('[CRM-Sync] PIPELINE_CRM_API_KEY missing');
      return NextResponse.json({ error: 'CRM not configured' }, { status: 503 });
    }

    console.log(`[CRM-Sync] Syncing high-value lead: ${email} (Score: ${lead_score})`);

    // 1. Prepare Pipeline CRM Payload
    const payload = {
      person: {
        first_name: first_name || 'Protocol',
        last_name: last_name || 'Lead',
        email: email,
        organization_name: company_name || 'Unknown Enterprise',
        type: 'Lead',
        lead_status_id: lead_score > 70 ? 1 : 2, // 1: Hot, 2: Warm
        custom_fields: {
          custom_field_lead_score: lead_score,
          custom_field_source: 'AuthiChain Protocol'
        }
      }
    };

    // 2. Execute Sync
    const res = await fetch(`${PIPELINE_API_URL}?api_key=${PIPELINE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pipeline CRM API Error: ${res.status} - ${errText}`);
    }

    const data = await res.json();

    // 3. Log Success to Supabase
    await admin.from('automation_logs').insert({
      workflow_name: 'crm_sync',
      trigger_type: 'event',
      status: 'success',
      payload: JSON.stringify({ email, person_id: data.id })
    });

    return NextResponse.json({ success: true, person_id: data.id });

  } catch (err: unknown) {
    console.error('[CRM-Sync] Critical Failure:', err);
    return NextResponse.json({ 
      error: 'CRM synchronization failed',
      detail: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

/**
 * GET handler for Vercel Cron invocation
 * Pulled from Z-kie/AuthiChain/workers/pipeline-deals
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_API_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Trigger batch CRM cleanup or sync
  console.log('[CRM-Sync] Vercel Cron: Initiating batch sync cycle...');
  
  return NextResponse.json({ status: 'Batch cycle initiated' });
}
