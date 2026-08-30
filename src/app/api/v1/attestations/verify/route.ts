import { NextRequest, NextResponse } from "next/server";
import {
  publicJwkFromPrivateKey,
  verifyAttestationJws,
} from "@authichain/verifier";
import { importPKCS8 } from "jose";

async function loadPrivateKey() {
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw)
    throw new Error("AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 not configured");
  const pem = Buffer.from(raw, "base64").toString("utf8");
  return importPKCS8(pem, "EdDSA");
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body.jws !== "string" || !body.jws.trim()) {
      return NextResponse.json(
        { valid: false, error: "jws is required" },
        { status: 400 }
      );
    }

    const privateKey = await loadPrivateKey();
    const attestation = await verifyAttestationJws(
      body.jws,
      await publicJwkFromPrivateKey(privateKey)
    );
    const now = Date.now();
    const expired =
      attestation.expires_at !== undefined &&
      Date.parse(attestation.expires_at) <= now;
    const status = expired ? "expired" : attestation.status;
    const valid =
      !expired &&
      attestation.status === "active" &&
      attestation.decision === "verified";

    return NextResponse.json(
      {
        valid,
        contract: "AuthiChain Attestation Contract",
        version: "0.1",
        issuer: attestation.issuer,
        subject: attestation.subject,
        decision: attestation.decision,
        status,
        attestation_id: attestation.attestation_id,
        issued_at: attestation.issued_at,
        expires_at: attestation.expires_at,
        evidence: attestation.evidence,
      },
      { status: valid ? 200 : 409 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "invalid attestation",
      },
      { status: 400 }
    );
  }
}
