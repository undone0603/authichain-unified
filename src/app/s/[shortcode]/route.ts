import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchWebhook } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const { shortcode } = await params;
  const supabase = await createClient();

  // 1. Resolve QRON (Try ID first if numeric, then short_code)
  const isNumeric = /^\d+$/.test(shortcode);
  let query = supabase.from('qrons').select('*');
  
  if (isNumeric) {
    query = query.or(`id.eq.${shortcode},short_code.eq.${shortcode}`);
  } else {
    query = query.eq('short_code', shortcode);
  }

  const { data: qron, error: qronError } = await query.single();

  if (qronError || !qron) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Fetch Active Redirect Rules
  const { data: rules } = await supabase
    .from('redirect_rules')
    .select('*')
    .eq('qron_id', qron.id)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  let destination = qron.target_url;

  // 3. Evaluate Rules
  if (rules && rules.length > 0) {
    const userAgent = request.headers.get('user-agent') || '';
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'US';
    const now = new Date();

    for (const rule of rules) {
      if (rule.start_time && new Date(rule.start_time) > now) continue;
      if (rule.end_time && new Date(rule.end_time) < now) continue;

      if (rule.rule_type === 'device') {
        const targetDevice = rule.configuration?.device;
        const isMobile = /mobile/i.test(userAgent);
        const isTablet = /tablet/i.test(userAgent);
        if (targetDevice === 'mobile' && !isMobile) continue;
        if (targetDevice === 'tablet' && !isTablet) continue;
        if (targetDevice === 'desktop' && (isMobile || isTablet)) continue;
      }

      if (rule.rule_type === 'location' && rule.geo_targets) {
        const targets = rule.geo_targets;
        if (targets.length > 0 && !targets.includes(country)) continue;
      }

      if (rule.rule_type === 'a_b') {
        const weight = rule.a_b_weight || 50;
        if (Math.random() * 100 > weight) continue;
      }

      if (rule.configuration?.redirect_url) {
        destination = rule.configuration.redirect_url;
        break;
      }
    }
  }

  // 4. Log Scan / Analytics (Background — fire-and-forget)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'unknown';
  const region = request.headers.get('x-vercel-ip-country-region') || 'unknown';
  const city = request.headers.get('x-vercel-ip-city') || 'unknown';

  // 4a. Atomic increment — avoids read-modify-write race under concurrent scans
  supabase
    .rpc('increment_scan_count', { qron_uuid: qron.id })
    .then(undefined, (err) => {
      console.error('[shortcode] Failed to increment scan_count:', err);
    });

  // 4b. Log granular scan event
  supabase
    .from('scan_logs')
    .insert({ qron_id: qron.id, ip, country, region, city, user_agent: userAgent })
    .then(undefined, (err) => {
      console.error('[shortcode] Failed to insert scan_log:', err);
    });

  // 4c. Dispatch Real-Time Webhook
  dispatchWebhook(qron.user_id, 'qron_scanned', {
    qron_id: qron.id,
    target_url: destination,
    timestamp: new Date().toISOString(),
    location: { country, region, city },
    device: { user_agent: userAgent, ip },
  });

  // 5. Execute Redirect
  if (qron.story_enabled) {
    const revealUrl = new URL(`/reveal/${qron.id}`, request.url);
    revealUrl.searchParams.set('dest', destination);
    return NextResponse.redirect(revealUrl);
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
