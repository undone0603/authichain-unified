import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface FunnelEventPayload {
  prospect_id: string;
  stage:
    | 'proposal_sent'
    | 'email_opened'
    | 'link_clicked'
    | 'visit_landing_page'
    | 'start_checkout'
    | 'complete_checkout'
    | 'subscribe';
  source: 'gov_engine' | 'linkedin_post' | 'reddit_post' | 'seo' | 'direct' | 'email' | 'affiliate';
  event_type?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body: FunnelEventPayload = await request.json();

    // Validate required fields
    if (!body.prospect_id || !body.stage || !body.source) {
      return NextResponse.json(
        { error: 'Missing required fields: prospect_id, stage, source' },
        { status: 400 }
      );
    }

    // Validate enum values
    const validStages = [
      'proposal_sent',
      'email_opened',
      'link_clicked',
      'visit_landing_page',
      'start_checkout',
      'complete_checkout',
      'subscribe',
    ];
    const validSources = ['gov_engine', 'linkedin_post', 'reddit_post', 'seo', 'direct', 'email', 'affiliate'];

    if (!validStages.includes(body.stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validSources.includes(body.source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    // Get Supabase service client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Insert funnel event
    const { data, error } = await supabase.from('funnel_events').insert({
      prospect_id: body.prospect_id,
      stage: body.stage,
      source: body.source,
      event_type: body.event_type || null,
      metadata: body.metadata || {},
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[funnel] Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to record funnel event', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Funnel event recorded',
        prospect_id: body.prospect_id,
        stage: body.stage,
        source: body.source,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[funnel] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for health check / documentation
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      message: 'Funnel tracking API',
      usage: {
        method: 'POST',
        endpoint: '/api/funnel',
        body: {
          prospect_id: 'string (required)',
          stage:
            'proposal_sent | email_opened | link_clicked | visit_landing_page | start_checkout | complete_checkout | subscribe',
          source: 'gov_engine | linkedin_post | reddit_post | seo | direct | email | affiliate',
          event_type: 'string (optional)',
          metadata: 'object (optional)',
        },
        example: {
          prospect_id: 'prospect_12345',
          stage: 'email_opened',
          source: 'gov_engine',
          event_type: 'opened_via_campaign_5',
          metadata: {
            campaign_id: 'campaign_5',
            email_id: 'email_abc123',
            client_ip: '192.168.1.1',
          },
        },
      },
    },
    { status: 200 }
  );
}
