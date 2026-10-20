import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { certificationScanDecision } from '../../../../../server/passport-verdict';

export const dynamic = 'force-dynamic';

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
    if (registrationId) query = query.eq('id', registrationId);

    const { data: cert, error: certError } = await query.single();

    if (certError || !cert) {
      return NextResponse.json({ 
        decision: 'invalid', 
        error: 'Asset not found' 
      }, { status: 404 });
    }

    const products = cert.products;
    const product = Array.isArray(products) ? products[0] : products;
    // An approved row is not signed as verified. The scan reads a stored passport.
    const verdict = certificationScanDecision(product ?? null, cert);

    return NextResponse.json({
      object_id: `authi:${cert.id}`,
      ...verdict,
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
