/**
 * @file edge.ts
 * @project qron-platform
 * @author AuthiChain Edge Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 * 
 * High-Performance Edge Redirect Engine for "Living Portals".
 * Intercepts /s/[shortcode] and executes redirect rules at the network edge.
 */

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface Brand {
  id: string;
}

interface QRON {
  id: string;
  target_url: string;
  scan_count: number;
}

interface RedirectRule {
  id: string;
  qron_id: string;
  is_active: boolean;
  priority: number;
  start_time?: string;
  end_time?: string;
  rule_type: string;
  configuration?: {
    device?: string;
    redirect_url?: string;
  };
  a_b_weight?: number;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get('host') || '';
    const hostname = host.toLowerCase().split(':')[0];

    // 1. Health Check & Diagnostics
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        status: 'Ecosystem Edge Live', 
        node: 'Active',
        detected_host: hostname
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Shortcode Redirect Engine (/s/[id] or /s/[shortcode])
    if (url.pathname.startsWith('/s/')) {
      const shortcode = url.pathname.split('/')[2];
      if (!shortcode) return Response.redirect(`${url.origin}/`, 302);

      try {
        const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

        // 2a. Dynamic Brand Domain Resolution
        let _brandId: string | null = null;
        const isStandardDomain = hostname.includes('qron.space') || hostname.includes('localhost') || hostname.includes('vercel.app');
        
        if (!isStandardDomain) {
          const brandRes = await fetch(`${supabaseUrl}/rest/v1/brands?domain=eq.${hostname}&select=id`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
          });
          const brands = await brandRes.json() as Brand[];
          if (brands && brands.length > 0) {
            _brandId = brands[0].id;
          }
        }

        // 2b. Fetch QRON (support both numeric ID and short_code)
        const isNumeric = /^\d+$/.test(shortcode);
        const qronFilter = isNumeric 
          ? `or=(id.eq.${shortcode},short_code.eq.${shortcode})`
          : `short_code.eq.${shortcode}`;

        const qronRes = await fetch(`${supabaseUrl}/rest/v1/qrons?${qronFilter}&select=*`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const qrons = await qronRes.json() as QRON[];

        if (!qrons || qrons.length === 0) {
          return Response.redirect(`${url.origin}/`, 302);
        }

        const qron = qrons[0];

        // 2c. Fetch Active Redirect Rules
        const rulesRes = await fetch(`${supabaseUrl}/rest/v1/redirect_rules?qron_id=eq.${qron.id}&is_active=eq.true&order=priority.asc`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const rules = await rulesRes.json() as RedirectRule[];

        let destination = qron.target_url;

        // 2d. Evaluate Rules at the Edge
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

            if (rule.configuration?.redirect_url) {
              destination = rule.configuration.redirect_url;
              break;
            }
          }
        }

        // 3. Analytics & Logging (Fire-and-forget in background)
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const country = request.headers.get('cf-ipcountry') || 'unknown';
        const city = request.headers.get('cf-ipcity') || 'unknown';
        const region = request.headers.get('cf-region') || 'unknown';

        // Update Scan Count (using correct ID)
        fetch(`${supabaseUrl}/rest/v1/qrons?id=eq.${qron.id}`, {
          method: 'PATCH',
          headers: { 
            'apikey': serviceKey, 
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ scan_count: (qron.scan_count || 0) + 1 })
        });

        // Log Detailed Activity
        fetch(`${supabaseUrl}/rest/v1/scan_logs`, {
          method: 'POST',
          headers: { 
            'apikey': serviceKey, 
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            qron_id: qron.id,
            ip,
            country,
            city,
            region,
            user_agent: userAgent
          })
        });

        return Response.redirect(destination, 302);

      } catch (err) {
        console.error('[edge] Redirect error:', err);
        return Response.redirect(`${url.origin}/`, 302);
      }
    }

    // Default Fallback
    return new Response(JSON.stringify({ error: 'Unauthorized Edge Access' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  },
};

export default worker;
