import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ProtocolHSM } from '@/../server/hsm-service';

export const dynamic = 'force-dynamic';

/**
 * AuthiChain Genesis Manifest API
 * GET /api/v1/protocol/manifest
 * 
 * Generates a signed report of all protocol milestones.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // 1. Aggregate proof-of-work
  const [logs, products, leadSuccess] = await Promise.all([
    supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('products').select('id, blockchainTxHash').not('blockchainTxHash', 'is', null),
    supabase.from('lead_captures').select('id').eq('status', 'active_partner')
  ]);

  const milestones = [
    "Real QRON Ledger",
    "Dynamic Identity Timelines",
    "GPT-4 Vision Photo Proof",
    "Autonomous Revenue Blitz",
    "Digital Twin Portals",
    "W3C Verifiable Credentials",
    "QRON Siphon Revenue Loop",
    "Data-Driven Industry Rankings",
    "Truth Anchor Worker (L1/L2)",
    "Agent XP Gamification",
    "Global Truth 3D Map",
    "EU DPP Regulatory Auditor",
    "Viral Media Factory",
    "5-Agent Security Council Consensus",
    "FIPS 140-2 Secure HSM Module",
    "Matrix Live Activity Feed",
    "Sovereign Brand Activator",
    "Hybrid Protocol Governance",
    "Truth SDK & Global Seal",
    "ZK-Proof Selective Metadata Disclosure"
  ];

  const manifest = {
    protocol: "AuthiChain Unified Core",
    version: "v3.0-DOMINANT",
    timestamp: new Date().toISOString(),
    network: "Polygon Mainnet + Bitcoin L1",
    entity: {
       name: "AuthiChain, Inc.",
       uei: "R34XKWRJY9A5",
       cage: "1PUJ6"
    },
    achievements: milestones,
    proofOfWork: {
       totalProductsAnchored: products.data?.length || 0,
       totalRevenuePartners: leadSuccess.data?.length || 0,
       recentAutomationHeartbeats: logs.data?.length || 0,
       blockchainLedgerSample: products.data?.slice(0, 3).map(p => p.blockchainTxHash)
    },
    fipsCompliance: "Hardened Ed25519 Secure Enclave"
  };

  // 2. Sign the Manifest
  const payloadToSign = JSON.stringify(manifest);
  const signature = await ProtocolHSM.signSovereign(payloadToSign);

  const signedManifest = {
    ...manifest,
    proof: {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      creator: "did:authichain:protocol:master",
      signatureValue: signature
    }
  };

  return NextResponse.json(signedManifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'X-Protocol-Status': 'DOMINANT'
    }
  });
}
