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
    const now = new Date();

    for (const rule of rules) {
      // Time-based check
      if (rule.start_time && new Date(rule.start_time) > now) continue;
      if (rule.end_time && new Date(rule.end_time) < now) continue;

      // Device check
      if (rule.rule_type === 'device') {
        const targetDevice = rule.configuration?.device;
        const isMobile = /mobile/i.test(userAgent);
        const isTablet = /tablet/i.test(userAgent);
        
        if (targetDevice === 'mobile' && !isMobile) continue;
        if (targetDevice === 'tablet' && !isTablet) continue;
        if (targetDevice === 'desktop' && (isMobile || isTablet)) continue;
      }

      // A/B Test check
      if (rule.rule_type === 'a_b') {
        const weight = rule.a_b_weight || 50;
        const random = Math.random() * 100;
        if (random > weight) continue;
      }

      // If we reach here, rule matches
      if (rule.configuration?.redirect_url) {
        destination = rule.configuration.redirect_url;
        break; // Stop at first matching rule
      }
    }
  }

  // 4. Log Scan / Analytics (Background)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  // Use Vercel/Cloudflare Geo headers if available
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'unknown';
  const region = request.headers.get('x-vercel-ip-country-region') || 'unknown';
  const city = request.headers.get('x-vercel-ip-city') || 'unknown';

  // 4a. Update QRON scan count
  supabase
    .from('qrons')
    .update({ scan_count: (qron.scan_count || 0) + 1 })
    .eq('id', qron.id)
    .then();

  // 4b. Log granular scan event
  supabase
    .from('scan_logs')
    .insert({
      qron_id: qron.id,
      ip,
      country,
      region,
      city,
      user_agent: userAgent
    })
    .then();

  // 4c. Dispatch Real-Time Webhook
  dispatchWebhook(qron.user_id, 'qron_scanned', {
    qron_id: qron.id,
    target_url: destination,
    timestamp: new Date().toISOString(),
    location: { country, region, city },
    device: { user_agent: userAgent, ip }
  });

  // 5. Execute Redirect
  return NextResponse.redirect(new URL(destination));
}
