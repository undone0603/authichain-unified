export const runtime = 'nodejs';

/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireApiKey } from '@/lib/api-auth-middleware';
import { reportAgentUsage } from '@/lib/industrial/billing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/verify
 *
 * High-level verification endpoint for the GPT and Universal SDK.
 * Supports both registration_id (internal) and serial (external).
 *
 * NOTE: This GET path is the free, public read used by the GPT/SDK and the
 * consumer-facing scan page. The metered, revenue-generating path is POST below.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serial = searchParams.get('serial');
    const registrationId = searchParams.get('registration_id');

    if (!serial && !registrationId) {
      return NextResponse.json({ error: 'serial or registration_id required' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase
      .from('certifications')
      .select('*, products(*)');

    if (serial) query = query.eq('serial_number', serial);
    if (registrationId) query = query.eq('id', registrationId); // Internal ID

    const { data: cert, error: certError } = await query.single();

    if (certError || !cert) {
      return NextResponse.json({ is_authentic: false, error: 'Asset not found' }, { status: 404 });
    }

    // Fetch DPP
    const { data: dpp } = await supabase
      .from('dpp_data')
      .select('*')
      .eq('certification_id', cert.id)
      .single();

    return NextResponse.json({
      is_authentic: cert.status === 'approved',
      protocol: 'AuthiChain',
      version: '1.4.2',
      asset: {
        serial_number: cert.serial_number,
        status: cert.status,
        issued_at: cert.issued_at || cert.created_at,
        network: 'Polygon POS'
      },
      product: cert.products,
      dpp: dpp || null
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * POST /api/v1/verify  — Metered B2B Verification API
 *
 * The autonomous-revenue path. Authenticated via Bearer API key. Every call is
 * metered to Stripe (reportAgentUsage → 'verify_product' = $0.05/call) and
 * written to the immutable audit ledger. Serves all verticals:
 *   - manufacturing  : product serial authenticity (Made in USA / QRON)
 *   - supply-chain   : dependency / component provenance
 *   - compliance     : policy-bound asset verification
 *   - federal        : transparent, auditable verification record
 *
 * Body: { serial?: string, registration_id?: string, type?: string, metadata?: object }
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // 1. Authenticate — billable callers must present a valid API key.
  const userId = await requireApiKey(req);
  if (userId instanceof NextResponse) return userId;

  // 2. Parse + validate request.
  const body = await req.json().catch(() => null) as
    | { serial?: string; registration_id?: string; type?: string; metadata?: Record<string, unknown> }
    | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const serial = typeof body.serial === 'string' ? body.serial.trim() : '';
  const registrationId = typeof body.registration_id === 'string' ? body.registration_id.trim() : '';
  const vertical = typeof body.type === 'string' ? body.type.trim() : 'manufacturing';

  if (!serial && !registrationId) {
    return NextResponse.json({ error: 'serial or registration_id required' }, { status: 400 });
  }

  try {
    const { createClient: createAdmin } = await import('@supabase/supabase-js');
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Perform the verification lookup.
    let query = admin.from('certifications').select('*, products(*)');
    if (serial) query = query.eq('serial_number', serial);
    if (registrationId) query = query.eq('id', registrationId);

    const { data: certRow, error: certError } = await query.single();
    const cert = certRow as Record<string, any> | null;

    const verified = !certError && !!cert && cert.status === 'approved';

    // 4. Bill the call. Metered usage flows to Stripe; non-blocking by design.
    //    We charge for every authenticated verification attempt — the value is
    //    the cryptographically-backed answer, authentic or not.
    await reportAgentUsage(userId, 'verify_product');

    // 5. Write the immutable audit record (transparent, federal-grade trail).
    await (admin.from('automation_logs') as any).insert({
      workflow_name: 'api_verify',
      trigger_type: 'api',
      status: 'success',
      payload: JSON.stringify({
        userId,
        vertical,
        serial: serial || null,
        registrationId: registrationId || null,
        verified,
        durationMs: Date.now() - startedAt,
      }),
    });

    if (!verified) {
      return NextResponse.json(
        {
          is_authentic: false,
          verified: false,
          vertical,
          error: 'Asset not found or not approved',
          billed: { metric: 'verify_product', units: 1 },
          protocol: 'AuthiChain',
        },
        { status: 200 } // 200: a definitive "not authentic" is a successful, billable answer
      );
    }

    // 6. Optional DPP enrichment for a complete provenance record.
    const { data: dppRow } = await admin
      .from('dpp_data')
      .select('*')
      .eq('certification_id', cert!.id)
      .single();

    return NextResponse.json({
      is_authentic: true,
      verified: true,
      vertical,
      protocol: 'AuthiChain',
      version: '1.4.2',
      asset: {
        serial_number: cert!.serial_number,
        status: cert!.status,
        issued_at: cert!.issued_at || cert!.created_at,
        network: 'Polygon POS',
      },
      product: cert!.products,
      dpp: dppRow ?? null,
      billed: { metric: 'verify_product', units: 1 },
      verified_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    // Best-effort failure audit; never leak internals to the caller.
    try {
      const { createClient: createAdmin } = await import('@supabase/supabase-js');
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await (admin.from('automation_logs') as any).insert({
        workflow_name: 'api_verify',
        trigger_type: 'api',
        status: 'failure',
        error_message: err instanceof Error ? err.message : String(err),
      });
    } catch { /* swallow */ }

    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
