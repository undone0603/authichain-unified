import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
/**
 * Prepares the witness data for a new QRON Ordinal Inscription.
 * This wraps the Artistic QR SVG/PNG into the proper Bitcoin envelope format.
 */
export async function prepareOrdinalEnvelope(imageUrl, metadata) {
    // Logic to convert image buffer to Ordinal-ready hex envelope
    // Using a bridge like Ordinals.com or direct node RPC
    return {
        protocol: "ord",
        version: "1.0",
        body: metadata,
        image_ref: imageUrl
    };
}
/**
 * Tracks the status of an inscription on-chain.
 */
const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;
export async function getInscriptionStatus(inscriptionId) {
    if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
        return { status: "invalid", error: "Invalid inscription ID format" };
    }
    const res = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`);
    if (!res.ok)
        return { status: "pending" };
    return await res.json();
}
/**
 * Links a QronCode to its BTC Ordinal counterpart and existing Polygon NFT.
 */
export async function linkOrdinalToProduct(productId, inscriptionId) {
    const d = await getDb();
    if (!d)
        throw new Error("Database not available");
    await d.update(products)
        .set({ blockchainTxHash: inscriptionId })
        .where(eq(products.id, productId));
    console.log(`[Ordinals] Linked Product ${productId} to BTC Inscription ${inscriptionId}`);
    return { success: true };
}
