import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { products } from "../drizzle/schema";

/**
 * BTC Ordinals Inscription Service
 * Prepares and tracks QRON Artistic QR codes on Bitcoin via Ordinals protocol.
 */

export interface OrdinalMetadata {
  inscriptionId?: string;
  satNumber?: number;
  contentUrl: string;
  contentType: string;
  productId: string;
  truemarkId: string;
  artist: string;
  timestamp: string;
}

const ORDINALSBOT_API_BASE = "https://api.ordinalsbot.com";

/**
 * Prepares the witness data for a new QRON Ordinal Inscription.
 * Fetches the source image and base64-encodes it into an ord-protocol envelope
 * body ready to hand to an inscription provider.
 */
export async function prepareOrdinalEnvelope(imageUrl: string, metadata: any) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Ordinal content from ${imageUrl}: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    protocol: "ord",
    version: "1.0",
    body: metadata,
    image_ref: imageUrl,
    content_type: contentType,
    content_base64: base64
  };
}

/**
 * Submits a prepared Ordinal envelope to an inscription-as-a-service provider
 * (OrdinalsBot) that funds, builds, and broadcasts the commit/reveal transactions
 * on Bitcoin. AuthiChain does not run its own Bitcoin node or hold BTC UTXOs, so
 * inscription creation is delegated to this bridge rather than done in-process.
 * Requires ORDINALSBOT_API_KEY and a receiveAddress to hold the inscribed sat.
 */
export async function createInscriptionOrder(
  envelope: { content_base64: string; content_type: string },
  receiveAddress: string,
  apiKey: string
) {
  if (!apiKey) throw new Error("ORDINALSBOT_API_KEY is not configured");
  if (!receiveAddress) throw new Error("receiveAddress is required to create an inscription order");

  const res = await fetch(`${ORDINALSBOT_API_BASE}/order-inscription`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      files: [
        {
          name: "authichain-inscription",
          dataURL: `data:${envelope.content_type};base64,${envelope.content_base64}`
        }
      ],
      receiveAddress,
      fee: 10
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OrdinalsBot order creation failed: ${errorText}`);
  }

  return await res.json();
}

/**
 * Tracks the status of an inscription on-chain.
 */
const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

export async function getInscriptionStatus(inscriptionId: string) {
  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return { status: "invalid", error: "Invalid inscription ID format" };
  }
  const res = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`);
  if (!res.ok) return { status: "pending" };
  return await res.json();
}

/**
 * Links a QronCode to its BTC Ordinal counterpart and existing Polygon NFT.
 */
export async function linkOrdinalToProduct(productId: string, inscriptionId: string) {
  const d = await getDb();
  if (!d) throw new Error("Database not available");

  await d.update(products)
    .set({ blockchainTxHash: inscriptionId })
    .where(eq(products.id, productId));

  console.log(`[Ordinals] Linked Product ${productId} to BTC Inscription ${inscriptionId}`);
  return { success: true };
}
