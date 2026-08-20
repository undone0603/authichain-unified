import { NextRequest, NextResponse } from 'next/server';
import {
  signAttestation,
  validateAttestation,
  verifyAttestationJws,
  publicJwkFromPrivateKey,
  getKeyId,
} from '@/lib/attestation/v01';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/attestation
 *
 * Reference implementation for AuthiChain Attestation Contract v0.1.
 * Accepts a v0.1 attestation payload and returns a compact JWS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const attestation = validateAttestation(body);
    const jws = await signAttestation(attestation);

    return NextResponse.json({
      contract: 'AuthiChain Attestation Contract',
      version: '0.1',
      attestation,
      jws,
      kid: await getKeyId(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'invalid attestation' },
      { status: 400 },
    );
  }
}

/**
 * PUT /api/v1/attestation
 *
 * Verifies a compact JWS using the deployment's public Ed25519 key.
 */
export async function PUT(req: NextRequest) {
  try {
    const { jws } = await req.json();
    if (typeof jws !== 'string') throw new Error('jws is required');
    const publicJwk = await publicJwkFromPrivateKey();
    const attestation = await verifyAttestationJws(jws, publicJwk);
    return NextResponse.json({
      valid: true,
      contract: 'AuthiChain Attestation Contract',
      version: '0.1',
      attestation,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'invalid signature' },
      { status: 400 },
    );
  }
}
