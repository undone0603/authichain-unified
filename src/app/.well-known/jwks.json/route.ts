import { NextResponse } from "next/server";
import { publicJwkFromPrivateKey, getKeyId } from "@authichain/verifier";

export const dynamic = "force-dynamic";

/** GET /.well-known/jwks.json */
export async function GET() {
  try {
    const jwk = await publicJwkFromPrivateKey();
    const kid =
      process.env.AUTHICHAIN_ATTESTATION_KEY_ID || (await getKeyId());
    return NextResponse.json({
      keys: [{ ...jwk, kid, use: "sig", alg: "EdDSA" }],
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
