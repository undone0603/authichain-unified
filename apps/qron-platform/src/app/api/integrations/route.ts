import { NextRequest, NextResponse } from 'next/server';

// GET /api/integrations - List available and connected integrations
export async function GET(req: NextRequest) {
  try {
    const integrations = [
      {
        id: 'stripe',
        name: 'Stripe',
        category: 'payments',
        status: 'connected',
        description: 'Accept payments and manage subscriptions',
        connected_at: '2024-09-01',
        webhook_url: 'https://qron.space/api/webhooks/stripe',
      },
      {
        id: 'shopify',
        name: 'Shopify',
        category: 'ecommerce',
        status: 'available',
        description: 'Auto-generate QR codes for product listings',
        connected_at: null,
      },
      {
        id: 'zapier',
        name: 'Zapier',
        category: 'automation',
        status: 'available',
        description: 'Connect QRON to 5,000+ apps via Zapier',
        connected_at: null,
      },
      {
        id: 'slack',
        name: 'Slack',
        category: 'notifications',
        status: 'connected',
        description: 'Send scan alerts and milestone notifications to Slack',
        connected_at: '2024-10-15',
        webhook_url: 'https://hooks.slack.com/services/xxx',
      },
      {
        id: 'google_analytics',
        name: 'Google Analytics',
        category: 'analytics',
        status: 'connected',
        description: 'Send QR scan events to GA4',
        connected_at: '2024-09-20',
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        category: 'crm',
        status: 'available',
        description: 'Sync leads captured via QR code scans to HubSpot CRM',
        connected_at: null,
      },
    ];
    const { status, category } = Object.fromEntries(new URL(req.url).searchParams);
    const filtered = integrations.filter(i =>
      (!status || i.status === status) &&
      (!category || i.category === category)
    );
    return NextResponse.json({
      success: true,
      integrations: filtered,
      total: filtered.length,
      connected_count: integrations.filter(i => i.status === 'connected').length,
    });
  } catch (error) {
    console.error('Integrations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

// POST /api/integrations - Connect or disconnect an integration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { integration_id, action, config } = body;
    if (!integration_id || !action) {
      return NextResponse.json({ error: 'integration_id and action are required' }, { status: 400 });
    }
    if (!['connect', 'disconnect', 'test'].includes(action)) {
      return NextResponse.json({ error: 'action must be: connect, disconnect, or test' }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      integration_id,
      action,
      status: action === 'disconnect' ? 'disconnected' : 'connected',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Integrations POST error:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}
