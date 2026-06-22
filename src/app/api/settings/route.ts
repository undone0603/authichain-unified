import { NextRequest, NextResponse } from 'next/server';

// GET /api/settings - Get workspace settings
export async function GET(req: NextRequest) {
  try {
    const settings = {
      workspace: {
        id: 'ws_001',
        name: 'QRON Labs',
        domain: 'qron.space',
        logo: 'https://qron.space/logo.png',
        primary_color: '#6C47FF',
        timezone: 'America/New_York',
        language: 'en',
      },
      qr_defaults: {
        size: 256,
        error_correction: 'M',
        format: 'png',
        include_logo: true,
        logo_size_ratio: 0.2,
        frame_style: 'rounded',
      },
      scan_tracking: {
        enabled: true,
        track_location: true,
        track_device: true,
        track_referrer: true,
        retention_days: 365,
      },
      security: {
        two_factor_required: false,
        ip_whitelist: [],
        api_rate_limit: 1000,
        session_timeout_minutes: 1440,
      },
      notifications: {
        email_on_scan_milestone: true,
        milestone_threshold: 1000,
        email_on_payment: true,
        email_on_security_event: true,
        slack_webhook: 'https://hooks.slack.com/services/xxx',
      },
    };
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/settings - Update workspace settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, updates } = body;
    if (!section || !updates) {
      return NextResponse.json({ error: 'section and updates are required' }, { status: 400 });
    }
    const validSections = ['workspace', 'qr_defaults', 'scan_tracking', 'security', 'notifications'];
    if (!validSections.includes(section)) {
      return NextResponse.json({ error: `Invalid section. Valid sections: ${validSections.join(', ')}` }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      section,
      updated: updates,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
