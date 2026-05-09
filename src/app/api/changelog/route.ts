import { NextRequest, NextResponse } from 'next/server';

const CHANGELOG: { version: string; date: string; type: string; title: string; description: string; items: string[] }[] = [
  {
    version: '2.5.0',
    date: '2025-01-15',
    type: 'minor',
    title: 'AI Style Engine v2',
    description: 'Redesigned AI art style generation with improved quality and new presets.',
    items: [
      'New diffusion model for QR art generation',
      'Added 12 new style presets including Neon Noir and Watercolor',
      'Reduced generation time by 40%',
      'Bulk style apply for campaigns',
    ],
  },
  {
    version: '2.4.2',
    date: '2025-01-08',
    type: 'patch',
    title: 'Scan Analytics Improvements',
    description: 'Enhanced scan tracking with geo data and device breakdown.',
    items: [
      'Added city-level geolocation for scans',
      'Device type breakdown (mobile/tablet/desktop)',
      'Export scan data to CSV',
      'Fix: duplicate scans within 1 second window now deduplicated',
    ],
  },
  {
    version: '2.4.0',
    date: '2024-12-20',
    type: 'minor',
    title: 'Campaign Manager',
    description: 'Full campaign management with A/B testing and scheduling.',
    items: [
      'Create and schedule QR campaigns',
      'A/B test multiple destination URLs',
      'Campaign-level analytics dashboard',
      'Webhooks on campaign events',
    ],
  },
  {
    version: '2.3.0',
    date: '2024-12-01',
    type: 'minor',
    title: 'Team Collaboration',
    description: 'Multi-member workspace support with roles and permissions.',
    items: [
      'Invite team members with role-based access',
      'Admin, Editor, and Viewer roles',
      'Audit log for all team actions',
      'Transfer workspace ownership',
    ],
  },
  {
    version: '2.2.0',
    date: '2024-11-15',
    type: 'minor',
    title: 'Domain & White-label',
    description: 'Custom domains and white-label QR redirect pages.',
    items: [
      'Connect custom domains for QR redirect',
      'White-label landing pages with brand colors',
      'SSL auto-provisioning for custom domains',
      'Custom favicon and logo on redirect pages',
    ],
  },
  {
    version: '2.1.0',
    date: '2024-11-01',
    type: 'minor',
    title: 'API & Integrations',
    description: 'Public REST API and 20+ native integrations.',
    items: [
      'Public API with API key authentication',
      'Zapier integration',
      'Slack notifications for scan milestones',
      'HubSpot and Salesforce CRM sync',
    ],
  },
  {
    version: '2.0.0',
    date: '2024-10-01',
    type: 'major',
    title: 'QRON 2.0 Launch',
    description: 'Complete platform redesign with AI-powered QR generation.',
    items: [
      'New dashboard with drag-and-drop QR builder',
      'AI-generated QR art styles',
      'Dynamic QR codes with real-time redirect editing',
      'Subscription plans: Starter, Pro, Business, Enterprise',
    ],
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  let results = [...CHANGELOG];

  if (type && ['major', 'minor', 'patch'].includes(type)) {
    results = results.filter((entry) => entry.type === type);
  }

  results = results.slice(0, limit);

  return NextResponse.json({
    success: true,
    total: results.length,
    latest_version: CHANGELOG[0].version,
    entries: results,
  });
}
