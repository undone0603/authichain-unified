export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/admin/certifications  — list certifications (optionally by status)
 * POST /api/admin/certifications  — issue a new certification + optional DPP + NFC
 * Requires: authenticated session + admin role.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/utils/supabase/require-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('certifications')
      .select('*, products(*)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createClient();
    const { product_id, metadata, dpp_data, nfc_uid } = await request.json();

    const serial = `QRON-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: cert, error: certError } = await supabase
      .from('certifications')
      .insert({ product_id, serial_number: serial, status: 'pending', metadata: metadata || {} })
      .select()
      .single();

    if (certError) throw certError;

    if (dpp_data && cert) {
      await supabase.from('dpp_data').insert({
        certification_id: cert.id,
        material_composition: dpp_data.material_composition,
        carbon_footprint: dpp_data.carbon_footprint,
        repairability_score: dpp_data.repairability_score,
        supply_chain_provenance: dpp_data.supply_chain_provenance,
      });
    }

    if (nfc_uid && cert) {
      await supabase.from('nfc_tags').insert({
        certification_id: cert.id,
        chip_uid: nfc_uid,
        is_active: true,
      });
    }

    return NextResponse.json(cert);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
