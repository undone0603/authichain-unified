export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAutomation } from '@/lib/automation';

/**
 * POST /api/qron/scan-validate
 *
 * Proxies scan-validation request to AuthiChain scan-validate worker.
 * Returns: { scannable, decoded, confidence, registration_id }
 *
 * BUG FIXED: was using getSession() (client-side JWT decode only — forgeable).
 * Replaced with getUser() which re-validates the token against the Auth server.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      asset_url?: string;
      registration_id?: string;
    };
    const { asset_url, registration_id } = body;

    if (!asset_url || !registration_id) {
      return NextResponse.json(
        { error: 'asset_url and registration_id are required' },
        { status: 400 }
      );
    }

    // Validate asset_url scheme to prevent SSRF
    try {
      const parsed = new URL(asset_url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'Invalid asset_url scheme' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid asset_url' }, { status: 400 });
    }

    const authichainUrl = process.env.AUTHICHAIN_API_URL;
    if (!authichainUrl) {
      return NextResponse.json(
        { error: 'AUTHICHAIN_API_URL not configured' },
        { status: 503 }
      );
    }

    const res = await fetch(`${authichainUrl}/api/qron/scan-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.AUTHICHAIN_API_SECRET || '',
      },
      body: JSON.stringify({ asset_url, registration_id }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[qron/scan-validate] Error:', err);
    await logAutomation('scan_validate.post', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Scan validation failed' }, { status: 500 });
  }
}

/**
 * GET /api/qron/scan-validate?registration_id=...
 *
 * Fetch existing scan result from AuthiChain.
 * BUG FIXED: getSession() → getUser()
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const registrationId = searchParams.get('registration_id');

    if (!registrationId) {
      return NextResponse.json(
        { error: 'registration_id query param required' },
        { status: 400 }
      );
    }

    const authichainUrl = process.env.AUTHICHAIN_API_URL;
    if (!authichainUrl) {
      return NextResponse.json(
        { error: 'AUTHICHAIN_API_URL not configured' },
        { status: 503 }
      );
    }

    const res = await fetch(
      `${authichainUrl}/api/qron/scan-validate?registration_id=${encodeURIComponent(registrationId)}`,
      {
        headers: { 'X-API-Key': process.env.AUTHICHAIN_API_SECRET || '' },
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[qron/scan-validate GET] Error:', err);
    await logAutomation('scan_validate.get', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed to fetch scan result' }, { status: 500 });
  }
}
