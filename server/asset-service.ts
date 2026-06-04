/**
 * AuthiChain Asset Service
 * Manages the persistence and automated updates of generated industrial assets.
 */
import { getDb } from "./db";
import { products, deadLetterQueue } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { analyzeProductVision } from "./vision-service";
import { generateProductAudioStory } from "./audio-service";

/**
 * Executes the "Sync-to-Verify" asset generation pipeline for a product.
 * This runs after a METRC sync or a new product creation.
 */
export async function generateProductAssets(productId: number) {
  const db = await getDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId));

  if (!product) throw new Error(`Product ${productId} not found`);

  console.log(`🚀 Starting asset generation for Product ${productId}: ${product.name}`);

  try {
    // 1. Generate ProductDNA (Vision)
    let visionResult = null;
    if (product.imageUrl) {
      visionResult = await analyzeProductVision(product.imageUrl, product.category || "General");
    }

    // 2. Generate BrandVoice (Audio)
    const audioUrl = await generateProductAudioStory({
      brandName: product.brand || "AuthiChain Partner",
      strainName: product.name,
      thcContent: (product.metadata as any)?.thc || "N/A",
      harvestDate: product.manufacturingDate ? product.manufacturingDate.toISOString() : "Recent"
    });

    // 3. Persist to Database
    await db.update(products)
      .set({
        audioUrl,
        metadata: { ...(product.metadata as any), visionMarkers: visionResult?.markers || [], rarityScore: (product.metadata as any)?.rarity || 50 },
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    console.log(`✅ Assets persisted for Product ${productId}`);

  } catch (error: any) {
    console.error(`❌ Asset generation failed for Product ${productId}:`, error.message);
    
    // Push to Dead Letter Queue for retry
    await db.insert(deadLetterQueue).values({
      type: "asset_generation",
      payload: { productId },
      error: error.message,
      status: "pending",
    });
  }
}

/**
 * Retries failed asset generation tasks from the Dead Letter Queue.
 */
export async function retryFailedAssets() {
  const db = await getDb();
  const failedTasks = await db.select()
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.status, "pending"));

  console.log(`🔄 Retrying ${failedTasks.length} failed asset tasks...`);

  for (const task of failedTasks) {
    const { productId } = task.payload as any;
    try {
      await generateProductAssets(productId);
      await db.update(deadLetterQueue)
        .set({ status: "resolved" })
        .where(eq(deadLetterQueue.id, task.id));
    } catch (e) {
      await db.update(deadLetterQueue)
        .set({ retries: (task.retries || 0) + 1 })
        .where(eq(deadLetterQueue.id, task.id));
    }
  }
}
