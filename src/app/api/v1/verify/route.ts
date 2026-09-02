import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { attestationEngine, mapDbToIdentity, mapDbToEvidence } from '@/protocol/attestation';

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

    const { data: dpp } = await supabase
      .from('dpp_data')
      .select('*')
      .eq('certification_id', cert.id)
      .single();

    // 1. Map database state to Attestation Protocol
    const identity = mapDbToIdentity(cert.products, cert);
    const evidence = mapDbToEvidence(cert.products, cert, dpp);
    
    // 2. Generate a cryptographic attestation on-the-fly
    // In a full prod env, this might be retrieved from a cache or a ledger
    const attestation = await attestationEngine.createAttestation(
      cert.id,
      identity,
      evidence,
      cert.status === 'approved' ? 'verified' : 'blocked'
    );

    // 3. Return the Interoperable Verification Protocol response
    return NextResponse.json({
      object_id: `authi:${cert.id}`,
      decision: attestation.decision,
      issuer: attestation.issuer,
      subject: attestation.subject,
      attestation: attestation.signature.value,
      signature: attestation.signature,
      evidence: attestation.evidence,
      status: attestation.status,
      verified_at: attestation.verifiedAt
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
