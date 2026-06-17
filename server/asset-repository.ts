import { getDb } from "./db";
import { products, deadLetterQueue } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { IAssetRepository } from "./asset-types";

export class DbAssetRepository implements IAssetRepository {
  async getProductById(productId: number): Promise<any> {
    const db = await getDb();
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    return product;
  }
  async updateProductAssets(productId: number, data: any): Promise<void> {
    const db = await getDb();
    await db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, productId));
  }
  async enqueueFailedTask(task: any): Promise<void> {
    const db = await getDb();
    await db.insert(deadLetterQueue).values(task);
  }
  async getPendingTasks(): Promise<any[]> {
    const db = await getDb();
    return await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.status, "pending"));
  }
  async updateTaskStatus(id: number, status: string): Promise<void> {
    const db = await getDb();
    await db.update(deadLetterQueue).set({ status }).where(eq(deadLetterQueue.id, id));
  }
  async incrementTaskRetry(id: number): Promise<void> {
    const db = await getDb();
    // This requires reading the task first, which is not efficient.
    // For now, simplify and just assume increment or update is enough if we had the object.
    // Given the complexity of the original code, let's just make sure this fulfills the interface.
    await db.update(deadLetterQueue).set({ retries: sql`${deadLetterQueue.retries} + 1`, updatedAt: new Date() }).where(eq(deadLetterQueue.id, id));
  }
}
