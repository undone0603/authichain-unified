import { NextRequest, NextResponse } from "next/server";
import { mapEpcisToDsCsa, DsCsaEvidenceSchema } from "@authichain/evidence";
import { db } from "@/db";
import { supplyChainEvents, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importJWK, importPKCS8 } from "jose";
import { publicJwkFromPrivateKey } from "@authichain/verifier";

async function getPublicKey() {
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw)
    throw new Error("AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 not configured");
  const pem = Buffer.from(raw, "base64").toString("utf8");
  const privateKey = await importPKCS8(pem, "EdDSA");
  const publicJwk = await publicJwkFromPrivateKey(privateKey);
  return importJWK(publicJwk, "EdDSA");
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawEvent = await req.json();

    // 1. Map to DSCSA Evidence
    const evidence = mapEpcisToDsCsa(rawEvent);

    // 2. Validate against DSCSA Schema
    const validatedEvidence = DsCsaEvidenceSchema.parse(evidence);

    // 3. Idempotency Check
    const existing = await db
      .select()
      .from(supplyChainEvents)
      .where(eq(supplyChainEvents.id, validatedEvidence.id))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: true, id: validatedEvidence.id },
        { status: 200 }
      );
    }

    // 4. Cryptographic Verification
    const { signature, ...payload } = validatedEvidence;
    // Canonicalize the payload for verification - using simple JSON stringify for consistency
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const publicKey = (await getPublicKey()) as CryptoKey;
    const sigBytes = Buffer.from(signature, "base64");

    const verified = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      sigBytes,
      data
    );
    if (!verified) {
      return NextResponse.json(
        { error: "Invalid evidence signature" },
        { status: 400 }
      );
    }

    // 5. Resolve Product ID
    const product = await db.query.products.findFirst({
      where: eq(products.id, validatedEvidence.subject_id as any),
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 6. Persist
    await db.insert(supplyChainEvents).values({
      id: validatedEvidence.id,
      productId: product.id,
      eventType: validatedEvidence.type,
      metadata: validatedEvidence.metadata as any,
    });

    return NextResponse.json(
      { success: true, id: validatedEvidence.id },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid evidence" },
      { status: 400 }
    );
  }
}
