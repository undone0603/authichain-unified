import { NextResponse } from "next/server";
import { publicJwkFromPrivateKey, getKeyId } from "@authichain/verifier";

export const dynamic = "force-dynamic";

/** GET /.well-known/jwks.json */
export async function GET() {
  try {
    const jwk = await publicJwkFromPrivateKey();
    return NextResponse.json({
      keys: [{ ...jwk, kid: await getKeyId(), use: "sig", alg: "EdDSA" }],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "attestation key unavailable",
      },
      { status: 503 }
    );
  }
}
