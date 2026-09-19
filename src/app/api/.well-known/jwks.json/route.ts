import { NextRequest, NextResponse } from "next/server";
import { generateJWKS } from "@/protocol/attestation/jwks";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const privateKeyPem = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64
      ? Buffer.from(
          process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64,
          "base64"
        ).toString("utf8")
      : process.env.AUTHICHAIN_PRIVATE_KEY;

    const jwks = await generateJWKS(
      process.env.AUTHICHAIN_PUBLIC_KEY,
      privateKeyPem
    );

    return NextResponse.json(jwks);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate JWKS" },
      { status: 503 }
    );
  }
}
