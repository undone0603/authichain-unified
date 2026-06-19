export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ActivityLog {
  lead_id?: string;
  email?: string;
  activity_type: 'email_sent' | 'email_opened' | 'email_clicked' | 'call_scheduled' | 'demo_sent' | 'contract_sent' | 'note_added';
  description: string;
  details?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    const { data: logs, error } = await admin
      .from('lead_activity_logs')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      email,
      activity_count: logs?.length || 0,
      activities: logs || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActivityLog;
    const { lead_id, email, activity_type, description, details = {} } = body;

    if (!email && !lead_id) {
      return NextResponse.json(
        { error: 'Either email or lead_id required' },
        { status: 400 }
      );
    }

    let query = admin.from('lead_captures').select('id, email');

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

    const { data: log, error: logError } = await admin
      .from('lead_activity_logs')
      .insert({
        lead_id: lead.id,
        email: lead.email,
        activity_type,
        description,
        details: {
          ...details,
          logged_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (logError) throw logError;

    if (activity_type === 'email_opened') {
      await admin
        .from('lead_captures')
        .update({ emailOpened: true })
        .eq('id', lead.id);
    } else if (activity_type === 'email_clicked') {
      await admin
        .from('lead_captures')
        .update({ emailClicked: true })
        .eq('id', lead.id);
    } else if (activity_type === 'demo_sent') {
      await admin
        .from('lead_captures')
        .update({ demoStarted: true })
        .eq('id', lead.id);
    }

    return NextResponse.json({
      log_id: log?.id,
      email: lead.email,
      activity_type,
      description,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
