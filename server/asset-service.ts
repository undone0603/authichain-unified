/**
 * AuthiChain Asset Service
 * Manages the persistence and automated updates of generated industrial assets.
 */
  import { eq } from "drizzle-orm";
  import { deadLetterQueue,products } from "../drizzle/schema";
  import { generateProductAudioStory } from "./audio-service";
  import { getDb } from "./db";
  import { analyzeProductVision } from "./vision-service";

/**
 * Executes the "Sync-to-Verify" asset generation pipeline for a product.
 * This runs after a METRC sync or a new product creation.
 */
export async function generateProductAssets(productId: string) {
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
    const metadata = product.metadata as { thc?: unknown; rarity?: unknown } | null;
    const thc = metadata?.thc;
    const rarity = metadata?.rarity;
    const audioUrl = await generateProductAudioStory({
      brandName: product.brand || "AuthiChain Partner",
      strainName: product.name,
      ...(typeof thc === "string" || typeof thc === "number" ? { thcContent: String(thc) } : {}),
      ...(product.manufacturingDate ? { harvestDate: product.manufacturingDate.toISOString() } : {}),
    });

    // 3. Persist to Database
    await db.update(products)
      .set({
        audioUrl,
        visionMarkers: visionResult?.markers || [],
        ...(typeof rarity === "number" && Number.isFinite(rarity) ? { rarityScore: rarity } : {}),
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    console.log(`✅ Assets persisted for Product ${productId}`);

  } catch (error: any) {
    console.error(`❌ Asset generation failed for Product ${productId}:`, error.message);
    
    // Push to Dead Letter Queue for retry
    await db.insert(deadLetterQueue).values({
      taskType: "asset_generation",
      payload: { productId },
      error: error.message,
      status: "pending",
      lastAttemptedAt: new Date()
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
    } catch (_unused_e_82) {
      await db.update(deadLetterQueue)
        .set({ 
          retryCount: (task.retryCount || 0) + 1,
          lastAttemptedAt: new Date() 
        })
        .where(eq(deadLetterQueue.id, task.id));
    }
  }
}
