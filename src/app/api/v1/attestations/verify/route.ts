import { NextRequest, NextResponse } from 'next/server';
import { publicJwkFromPrivateKey, verifyAttestationJws } from '@/lib/attestation/v01';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/attestations/verify
 *
 * Public verifier for the AuthiChain Attestation Contract v0.1.
 * Verification is anchored to this deployment's published Ed25519 key.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body.jws !== 'string' || !body.jws.trim()) {
      return NextResponse.json({ valid: false, error: 'jws is required' }, { status: 400 });
    }

    const attestation = await verifyAttestationJws(body.jws, await publicJwkFromPrivateKey());
    const now = Date.now();
    const expired = attestation.expires_at !== undefined && Date.parse(attestation.expires_at) <= now;
    const status = expired ? 'expired' : attestation.status;
    const valid = !expired && attestation.status === 'active' && attestation.decision === 'verified';

    return NextResponse.json({
      valid,
      contract: 'AuthiChain Attestation Contract',
      version: '0.1',
      issuer: attestation.issuer,
      subject: attestation.subject,
      decision: attestation.decision,
      status,
      attestation_id: attestation.attestation_id,
      issued_at: attestation.issued_at,
      expires_at: attestation.expires_at,
      evidence: attestation.evidence,
    }, { status: valid ? 200 : 409 });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'invalid attestation' },
      { status: 400 },
    );
  }
}
