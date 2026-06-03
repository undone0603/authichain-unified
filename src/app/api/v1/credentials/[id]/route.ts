import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SecurityCouncil } from '@/../server/_core/consensus';
import { ProtocolHSM } from '@/../server/hsm-service';

export const dynamic = 'force-dynamic';

/**
 * W3C Verifiable Credential Export Endpoint (High-Fidelity)
 * GET /api/v1/credentials/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);
  const supabase = await createClient();

  // 1. Run Security Council Consensus in real-time
  // This ensures the exported credential reflects the absolute latest truth.
  let consensus;
  try {
    consensus = await SecurityCouncil.renderVerdict(productId, { 
      trigger: "export_request",
      ip: req.headers.get("x-forwarded-for") || "internal"
    });
  } catch (err) {
    return NextResponse.json({ error: 'Consensus engine failed' }, { status: 500 });
  }

  // 2. Fetch Base Product Data
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // 3. Build W3C Verifiable Credential Payload
  const vc = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": `urn:authichain:credential:${product.id}`,
    "type": ["VerifiableCredential", "ProductAuthenticityCredential"],
    "issuer": "did:authichain:protocol:mainnet",
    "issuanceDate": new Date().toISOString(),
    "credentialSubject": {
      "id": `urn:authichain:artifact:${product.serialNumber || product.id}`,
      "name": product.name,
      "brand": product.brand,
      "consensusVerdict": consensus.status,
      "authenticityScore": consensus.finalScore,
      "agentVerdicts": consensus.verdicts,
      "blockchainAnchor": product.blockchain_tx_hash || product.blockchainTxHash
    }
  };

  // 4. Sign using FIPS 140-2 Protocol HSM
  try {
    const payloadToSign = JSON.stringify(vc);
    const signature = await ProtocolHSM.signSovereign(payloadToSign);

    const signedVc = {
      ...vc,
      "proof": {
        "type": "Ed25519Signature2020",
        "created": new Date().toISOString(),
        "proofPurpose": "assertionMethod",
        "verificationMethod": "did:authichain:protocol:mainnet#key-1",
        "signatureValue": signature
      }
    };

    return NextResponse.json(signedVc, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store' // High-fidelity credentials should not be cached
      }
    });
  } catch (err) {
    console.error('[VC-API] Secure signing failed:', err);
    return NextResponse.json({ error: 'Failed to generate signed credential' }, { status: 500 });
  }
}
