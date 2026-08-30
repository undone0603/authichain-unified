import { NextRequest, NextResponse } from "next/server";
import {
  signAttestation,
  validateAttestation,
  verifyAttestationJws,
  publicJwkFromPrivateKey,
  getKeyId,
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
    const attestation = validateAttestation(body);
    const privateKey = await loadPrivateKey();
    const keyId =
      process.env.AUTHICHAIN_ATTESTATION_KEY_ID || (await getKeyId(privateKey));
    const jws = await signAttestation(attestation, privateKey, keyId);

    return NextResponse.json({
      contract: "AuthiChain Attestation Contract",
      version: "0.1",
      attestation,
      jws,
      kid: keyId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid attestation" },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { jws } = await req.json();
    if (typeof jws !== "string") throw new Error("jws is required");
    const privateKey = await loadPrivateKey();
    const publicJwk = await publicJwkFromPrivateKey(privateKey);
    const attestation = await verifyAttestationJws(jws, publicJwk);
    return NextResponse.json({
      valid: true,
      contract: "AuthiChain Attestation Contract",
      version: "0.1",
      attestation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "invalid signature",
      },
      { status: 400 }
    );
  }
}
