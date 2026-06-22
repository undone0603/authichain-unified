/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/verify
 * 
 * High-level verification endpoint for the GPT and Universal SDK.
 * Supports both registration_id (internal) and serial (external).
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
