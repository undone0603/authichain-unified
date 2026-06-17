export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth-middleware';

/**
 * GET /api/settings
 * Returns the authenticated user's workspace settings.
 */
export async function GET(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { data: settings, error } = await admin
    .from('workspace_settings')
    .select('*')
    .eq('user_id', session.id)
    .maybeSingle();

  if (error) {
    console.error('[settings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }

  // Return defaults if no settings row exists yet
  const defaults = {
    qr_defaults: {
      size: 256,
      error_correction: 'M',
      format: 'png',
      include_logo: false,
      logo_size_ratio: 0.2,
      frame_style: 'rounded',
    },
    scan_tracking: {
      enabled: true,
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
    },
  };

  return NextResponse.json({
    success: true,
    settings: settings ?? defaults,
  });
}

/**
 * PATCH /api/settings
 * Updates a named section of the authenticated user's workspace settings.
 */
export async function PATCH(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { section, updates } = body as Record<string, unknown>;

  const validSections = ['qr_defaults', 'scan_tracking', 'security', 'notifications'];
  if (typeof section !== 'string' || !validSections.includes(section)) {
    return NextResponse.json(
      { error: `Invalid section. Valid: ${validSections.join(', ')}` },
      { status: 400 }
    );
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'updates must be an object' }, { status: 400 });
  }

  // Upsert: create settings row if absent, otherwise merge the section
  const { data: existing } = await admin
    .from('workspace_settings')
    .select('id, settings')
    .eq('user_id', session.id)
    .maybeSingle();

  const merged = {
    ...((existing?.settings ?? {}) as Record<string, unknown>),
    [section]: {
      ...((existing?.settings as Record<string, unknown>)?.[section] as Record<string, unknown> ?? {}),
      ...updates as Record<string, unknown>,
    },
  };

  const { error } = existing
    ? await admin.from('workspace_settings').update({ settings: merged, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await admin.from('workspace_settings').insert({ user_id: session.id, settings: merged });

  if (error) {
    console.error('[settings] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    section,
    updated_at: new Date().toISOString(),
  });
}
