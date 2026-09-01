import { NextRequest, NextResponse } from "next/server";
import { generateJWKS } from "@/protocol/attestation/jwks";

export async function GET(req: NextRequest) {
  try {
    const publicKeyPem =
      process.env.AUTHICHAIN_PUBLIC_KEY ||
      "-----BEGIN PUBLIC KEY-----\nMCowBwgJKuZrZCNAi la... (mock)\n-----END PUBLIC KEY-----";
    const jwks = await generateJWKS(publicKeyPem);

    return NextResponse.json(jwks);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate JWKS" },
      { status: 500 }
    );
  }
}
