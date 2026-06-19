export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STAGE_FLOW = ['new', 'contacted', 'qualified', 'demoed', 'contracted', 'signed', 'converted'];

const STAGE_ACTIONS = {
  new: 'Auto-score and segment',
  contacted: 'Send personalized intro email',
  qualified: 'Schedule initial discovery call',
  demoed: 'Send product demo recording',
  contracted: 'Prepare contract terms',
  signed: 'Onboard customer',
  converted: 'Document case study',
};

export async function POST(request: NextRequest) {
  try {
    const { lead_id, action, email } = await request.json();

    if (!lead_id && !email) {
      return NextResponse.json(
        { error: 'Either lead_id or email required' },
        { status: 400 }
      );
    }

    let query = admin.from('lead_captures').select('id, status, email, score, metadata');

    if (lead_id) {
      query = query.eq('id', lead_id);
    } else {
      query = query.eq('email', email);
    }

    const { data: leads } = await query.limit(1);
    const lead = leads?.[0];

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const currentStageIdx = STAGE_FLOW.indexOf(lead.status || 'new');
    const nextStageIdx = Math.min(currentStageIdx + 1, STAGE_FLOW.length - 1);
    const nextStage = STAGE_FLOW[nextStageIdx];

    const metadata = lead.metadata || {};
    const timeline = metadata.stage_timeline || {};
    timeline[nextStage] = new Date().toISOString();

    const { data: updated, error } = await admin
      .from('lead_captures')
      .update({
        status: nextStage,
        metadata: {
          ...metadata,
          stage_timeline: timeline,
          last_action: action || STAGE_ACTIONS[nextStage as keyof typeof STAGE_ACTIONS],
          last_action_at: new Date().toISOString(),
        },
      })
      .eq('id', lead.id)
      .select()
      .single();

    if (error) throw error;

    await admin.from('automation_logs').insert({
      workflow_name: `lead_stage_${nextStage}`,
      status: 'completed',
      payload: {
        lead_id: lead.id,
        email: lead.email,
        previous_stage: lead.status,
        new_stage: nextStage,
        action: action || STAGE_ACTIONS[nextStage as keyof typeof STAGE_ACTIONS],
      },
    });

    return NextResponse.json({
      lead_id: lead.id,
      email: lead.email,
      previous_stage: lead.status,
      new_stage: nextStage,
      action: action || STAGE_ACTIONS[nextStage as keyof typeof STAGE_ACTIONS],
      metadata: updated?.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
