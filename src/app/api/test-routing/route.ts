/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBrandFromHost } from '@/lib/brand-config';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/test-routing
 * 
 * Diagnostic endpoint to verify multi-domain routing, 
 * brand identification, and session persistence.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'unknown';
  const brand = getBrandFromHost(host);
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const diagnostics = {
    timestamp: new Date().toISOString(),
    routing: {
      detected_host: host,
      normalized_hostname: host.toLowerCase().split(':')[0],
      identified_brand: brand.name,
      brand_id: brand.id,
      brand_domain: brand.domain,
    },
    environment: {
      url: req.url,
      method: req.method,
      user_agent: req.headers.get('user-agent'),
    },
    identity: {
      is_authenticated: !!user,
      user_id: user?.id || null,
      user_email: user?.email || null,
    },
    status: 'Operational',
    protocol_version: 'v1.4.2-ecosystem'
  };

  return NextResponse.json(diagnostics, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-AuthiChain-Trace': 'diagnostic-active'
    }
  });
}
