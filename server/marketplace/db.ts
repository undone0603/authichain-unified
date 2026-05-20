import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import { aiModels, modelPurchases, modelReviews } from "../../drizzle/schema";

export async function listModels(filters?: { category?: string; status?: string; limit?: number }) {
  let query = db.select().from(aiModels);
  const conditions = [];
  if (filters?.status) conditions.push(eq(aiModels.status, filters.status as any));
  if (filters?.category) conditions.push(eq(aiModels.category, filters.category));
  if (conditions.length) {
    query = query.where(and(...conditions)) as typeof query;
  }
  return await query.orderBy(desc(aiModels.downloads)).limit(filters?.limit || 50);
}

export async function getModelById(id: number): Promise<typeof aiModels.$inferSelect | undefined> {
  const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id)).limit(1);
  return model;
}

export async function createModel(data: {
  name: string;
  description?: string;
  category?: string;
  price: number;
  creatorId: number;
}) {
  const result = await db.insert(aiModels).values({ ...data, status: "draft" });
  return { id: result[0].insertId };
}

export async function purchaseModel(data: {
  userId: number;
  modelId: number;
  pricePaid: number;
  purchaseType: "purchase" | "subscription" | "rental";
  expiresAt?: Date;
}) {
  const result = await db.insert(modelPurchases).values({ ...data, status: "active" });
  // Increment download count
  await db.update(aiModels)
    .set({ downloads: sql`${aiModels.downloads} + 1` })
    .where(eq(aiModels.id, data.modelId));
  return { id: result[0].insertId };
}

export async function getUserPurchases(userId: number) {
  return await db.select().from(modelPurchases)
    .where(eq(modelPurchases.userId, userId))
    .orderBy(desc(modelPurchases.createdAt));
}

export async function addReview(data: { modelId: number; userId: number; rating: number; review?: string }) {
  const result = await db.insert(modelReviews).values(data);
  // Update model rating average
  const [avg] = await db.select({ avg: sql<string>`AVG(rating)`, count: sql<number>`COUNT(*)` })
    .from(modelReviews)
    .where(eq(modelReviews.modelId, data.modelId));
  await db.update(aiModels)
    .set({ rating: avg.avg, reviewCount: avg.count })
    .where(eq(aiModels.id, data.modelId));
  return { id: result[0].insertId };
}

export async function getModelReviews(modelId: number) {
  return await db.select().from(modelReviews)
    .where(eq(modelReviews.modelId, modelId))
    .orderBy(desc(modelReviews.createdAt));
}
