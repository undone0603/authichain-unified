import { NextRequest, NextResponse } from "next/server";
import { EvidenceSchema, canonicalize } from "@authichain/evidence";
import { db } from "@/db";
import { supplyChainEvents, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { importPKCS8, importJWK, verify } from "jose";

async function getPublicKey() {
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw)
    throw new Error("AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 not configured");
  const pem = Buffer.from(raw, "base64").toString("utf8");
  const privateKey = await importPKCS8(pem, "EdDSA");
  // Derive public key from private key for verification
  return privateKey;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const evidence = EvidenceSchema.parse(body);

    // 1. Idempotency Check
    const existing = await db
      .select()
      .from(supplyChainEvents)
      .where(eq(supplyChainEvents.id, evidence.id))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: true, id: evidence.id },
        { status: 200 }
      );
    }

    // 2. Cryptographic Verification
    const { signature, ...payload } = evidence;
    const data = new TextEncoder().encode(canonicalize(payload));
    const publicKey = await getPublicKey();
    const sigBytes = Buffer.from(signature, "base64");

    // Using jose.verify with detached signature
    await verify(data, publicKey, {
      algorithms: ["EdDSA"],
      signature: sigBytes,
    });

    // 3. Resolve Product ID
    const product = await db.query.products.findFirst({
      where: eq(products.id, evidence.subject_id), // Assuming subject_id is the product UUID
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 4. Persist
    await db.insert(supplyChainEvents).values({
      id: evidence.id,
      productId: product.id,
      eventType: evidence.type,
      metadata: evidence.metadata || {},
    });

    return NextResponse.json(
      { success: true, id: evidence.id },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid evidence" },
      { status: 400 }
    );
  }
}
