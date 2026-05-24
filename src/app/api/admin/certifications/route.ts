import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { product_id, metadata, dpp_data, nfc_uid } = await request.json();

    // Manual serial generation: QRON-XXXX-XXXX
    const serial = `QRON-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Create Certification
    const { data: cert, error: certError } = await supabase
      .from('certifications')
      .insert({
        product_id,
        serial_number: serial,
        status: 'pending',
        metadata: metadata || {},
      })
      .select()
      .single();
    
    if (certError) throw certError;

    // 2. Create DPP Data if provided
    if (dpp_data && cert) {
      await supabase
        .from('dpp_data')
        .insert({
          certification_id: cert.id,
          material_composition: dpp_data.material_composition,
          carbon_footprint: dpp_data.carbon_footprint,
          repairability_score: dpp_data.repairability_score,
          supply_chain_provenance: dpp_data.supply_chain_provenance,
        });
    }

    // 3. Link NFC Tag if provided
    if (nfc_uid && cert) {
      await supabase
        .from('nfc_tags')
        .insert({
          certification_id: cert.id,
          chip_uid: nfc_uid,
          is_active: true
        });
    }

    return NextResponse.json(cert);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('certifications')
      .select('*, products(*)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
