import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/settings - Get user account settings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const settings = {
    user_id,
    account: {
      plan: 'pro',
      billing_cycle: 'monthly',
      renewal_date: '2026-06-09',
      auto_renew: true,
      trial_active: false,
      usage: {
        qr_codes_created: 247,
        qr_codes_limit: 1000,
        total_scans: 18420,
        api_calls_month: 4201,
        api_calls_limit: 10000,
        storage_mb: 124,
        storage_limit_mb: 5000
      }
    },
    notifications: {
      email_scan_alerts: true,
      email_weekly_report: true,
      email_billing: true,
      sms_alerts: false,
      push_notifications: false,
      scan_threshold_alert: 1000,
      alert_email: 'user@example.com'
    },
    branding: {
      custom_domain_enabled: false,
      custom_domain: null,
      logo_url: null,
      brand_color: '#1a56db',
      white_label: false,
      powered_by_text: 'Powered by QRON'
    },
    qr_defaults: {
      default_size: 400,
      default_error_correction: 'H',
      default_foreground: '#000000',
      default_background: '#ffffff',
      default_style: 'rounded',
      include_logo: false,
      track_scans: true,
      geolocation_tracking: false
    },
    api: {
      webhook_active: true,
      api_key_count: 2,
      rate_limit_per_min: 60,
      allowed_origins: ['https://example.com', 'https://app.example.com'],
      ip_whitelist_enabled: false
    },
    privacy: {
      data_retention_days: 365,
      anonymous_scans: false,
      gdpr_compliant: true,
      ccpa_compliant: true,
      data_export_available: true,
      last_data_export: null
    },
    integrations: {
      slack_connected: false,
      zapier_connected: true,
      google_analytics_id: 'G-XXXXXXXXXX',
      facebook_pixel: null,
      shopify_connected: false
    },
    created_at: '2025-06-15T10:00:00Z',
    updated_at: new Date().toISOString()
  };

  return NextResponse.json({
    success: true,
    settings,
    generated_at: new Date().toISOString()
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
