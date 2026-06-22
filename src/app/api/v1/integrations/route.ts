import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const connected = searchParams.get('connected');

  const integrations = [
    {
      id: 'int_zapier',
      name: 'Zapier',
      category: 'automation',
      description: 'Connect QRON with 5,000+ apps via Zapier automation workflows.',
      logo_url: '/integrations/zapier.svg',
      connected: false,
      status: 'available',
      features: ['Trigger on scan', 'Create QR codes', 'Update campaigns'],
      docs_url: 'https://docs.qron.space/integrations/zapier'
    },
    {
      id: 'int_slack',
      name: 'Slack',
      category: 'communication',
      description: 'Receive real-time QR scan notifications and alerts in Slack.',
      logo_url: '/integrations/slack.svg',
      connected: true,
      status: 'active',
      features: ['Scan notifications', 'Daily reports', 'Milestone alerts'],
      docs_url: 'https://docs.qron.space/integrations/slack'
    },
    {
      id: 'int_google_analytics',
      name: 'Google Analytics',
      category: 'analytics',
      description: 'Send QR scan events to Google Analytics for unified reporting.',
      logo_url: '/integrations/google-analytics.svg',
      connected: true,
      status: 'active',
      features: ['Event tracking', 'UTM parameters', 'Conversion tracking'],
      docs_url: 'https://docs.qron.space/integrations/google-analytics'
    },
    {
      id: 'int_hubspot',
      name: 'HubSpot',
      category: 'crm',
      description: 'Sync QR scan data with HubSpot contacts and deals.',
      logo_url: '/integrations/hubspot.svg',
      connected: false,
      status: 'available',
      features: ['Contact sync', 'Deal creation', 'Activity logging'],
      docs_url: 'https://docs.qron.space/integrations/hubspot'
    },
    {
      id: 'int_shopify',
      name: 'Shopify',
      category: 'ecommerce',
      description: 'Generate QR codes for products and track customer journeys.',
      logo_url: '/integrations/shopify.svg',
      connected: false,
      status: 'coming_soon',
      features: ['Product QR codes', 'Order tracking', 'Inventory links'],
      docs_url: 'https://docs.qron.space/integrations/shopify'
    },
    {
      id: 'int_mailchimp',
      name: 'Mailchimp',
      category: 'email_marketing',
      description: 'Track email campaign QR code scans and add subscribers.',
      logo_url: '/integrations/mailchimp.svg',
      connected: false,
      status: 'available',
      features: ['Scan tracking', 'Subscriber tagging', 'Campaign attribution'],
      docs_url: 'https://docs.qron.space/integrations/mailchimp'
    }
  ];

  let filtered = integrations;
  if (category) filtered = filtered.filter(i => i.category === category);
  if (connected !== null && connected !== undefined) {
    filtered = filtered.filter(i => i.connected === (connected === 'true'));
  }

  const categories = [...new Set(integrations.map(i => i.category))];
  const connected_count = integrations.filter(i => i.connected).length;

  return NextResponse.json({
    success: true,
    integrations: filtered,
    total: filtered.length,
    connected_count,
    available_count: integrations.filter(i => i.status === 'available').length,
    categories,
    generated_at: new Date().toISOString()
  });
}
