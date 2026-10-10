/**
 * @file edge.ts
 * @project qron-platform
 * @author AuthiChain Edge Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 * 
 * High-Performance Edge Redirect Engine for "Living Portals".
 * Intercepts /s/[shortcode] and executes redirect rules at the network edge.
 */

import { verifyWithCanonicalWorker } from "../../../packages/verifier/src/canonical-worker-client";

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUTHICHAIN_CANONICAL_VERIFY_URL?: string;
}

interface Brand { id: string; }
interface QRON { id: string; target_url: string; scan_count: number; }
interface RedirectRule {
  id: string;
  qron_id: string;
  is_active: boolean;
  priority: number;
  start_time?: string;
  end_time?: string;
  rule_type: string;
  configuration?: { device?: string; redirect_url?: string };
  a_b_weight?: number;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get('host') || '';
    const hostname = host.toLowerCase().split(':')[0];

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'Ecosystem Edge Live', node: 'Active', detected_host: hostname }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // QRON consumers use the canonical worker's signed decision as the protocol truth.
    // Visual, blockchain, community and gallery layers remain evidence and must not
    // manufacture a positive authenticity decision when the canonical worker blocks it.
    if (url.pathname === '/api/verify' && request.method === 'POST') {
      if (!env.AUTHICHAIN_CANONICAL_VERIFY_URL) {
        return new Response(JSON.stringify({ valid: false, decision: 'indeterminate', error: 'AUTHICHAIN_CANONICAL_VERIFY_URL not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      try {
        const body = await request.json() as { jws?: unknown; expected_object_id?: unknown };
        if (typeof body.jws !== 'string' || !body.jws.trim()) {
          return new Response(JSON.stringify({ valid: false, decision: 'indeterminate', error: 'jws is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        }
        const result = await verifyWithCanonicalWorker(
          env.AUTHICHAIN_CANONICAL_VERIFY_URL,
          body.jws.trim(),
          typeof body.expected_object_id === 'string' ? body.expected_object_id : undefined,
        );
        const canonicalPositive =
          result.httpStatus >= 200 &&
          result.httpStatus < 300 &&
          result.response.valid === true &&
          result.response.decision === 'verified';
        const response = canonicalPositive
          ? result.response
          : {
              ...result.response,
              valid: false,
              ...(result.response.decision === 'verified' ? { decision: 'indeterminate' } : {}),
              reasons: [
                ...(Array.isArray(result.response.reasons) ? result.response.reasons : []),
                'canonical_response_not_positive',
              ],
            };
        const status = canonicalPositive
          ? 200
          : result.httpStatus >= 400
            ? result.httpStatus
            : 409;
        return new Response(JSON.stringify(response), {
          status,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ valid: false, decision: 'indeterminate', error: error instanceof Error ? error.message : 'canonical verification failed' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }

    if (url.pathname.startsWith('/s/')) {
      const shortcode = url.pathname.split('/')[2];
      if (!shortcode) return Response.redirect(`${url.origin}/`, 302);

      try {
        const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

        let _brandId: string | null = null;
        const isStandardDomain = hostname.includes('qron.space') || hostname.includes('localhost') || hostname.includes('vercel.app');
        if (!isStandardDomain) {
          const brandRes = await fetch(`${supabaseUrl}/rest/v1/brands?domain=eq.${hostname}&select=id`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
          });
          const brands = await brandRes.json() as Brand[];
          if (brands && brands.length > 0) _brandId = brands[0].id;
        }

        const isNumeric = /^\d+$/.test(shortcode);
        const qronFilter = isNumeric ? `or=(id.eq.${shortcode},short_code.eq.${shortcode})` : `short_code.eq.${shortcode}`;
        const qronRes = await fetch(`${supabaseUrl}/rest/v1/qrons?${qronFilter}&select=*`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const qrons = await qronRes.json() as QRON[];
        if (!qrons || qrons.length === 0) return Response.redirect(`${url.origin}/`, 302);
        const qron = qrons[0];

        const rulesRes = await fetch(`${supabaseUrl}/rest/v1/redirect_rules?qron_id=eq.${qron.id}&is_active=eq.true&order=priority.asc`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const rules = await rulesRes.json() as RedirectRule[];
        let destination = qron.target_url;

        if (rules && rules.length > 0) {
          const userAgent = request.headers.get('user-agent') || '';
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
            if (rule.rule_type === 'a_b') {
              const weight = rule.a_b_weight || 50;
              const random = Math.random() * 100;
              if (random > weight) continue;
            }
            if (rule.configuration?.redirect_url) {
              destination = rule.configuration.redirect_url;
              break;
            }
          }
        }

        const userAgent = request.headers.get('user-agent') || 'unknown';
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const country = request.headers.get('cf-ipcountry') || 'unknown';
        const city = request.headers.get('cf-ipcity') || 'unknown';
        const region = request.headers.get('cf-region') || 'unknown';

        fetch(`${supabaseUrl}/rest/v1/qrons?id=eq.${qron.id}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_count: (qron.scan_count || 0) + 1 })
        });

        fetch(`${supabaseUrl}/rest/v1/scan_logs`, {
          method: 'POST',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ qron_id: qron.id, ip, country, city, region, user_agent: userAgent })
        });

        return Response.redirect(destination, 302);
      } catch (err) {
        console.error('[edge] Redirect error:', err);
        return Response.redirect(`${url.origin}/`, 302);
      }
    }

    return new Response(JSON.stringify({ error: 'Unauthorized Edge Access' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  },
};

export default worker;
