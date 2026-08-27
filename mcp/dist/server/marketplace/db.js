import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import { aiModels, modelPurchases, modelReviews } from "../../drizzle/schema";
export async function listModels(filters) {
    let query = db.select().from(aiModels);
    const conditions = [];
    if (filters?.status)
        conditions.push(eq(aiModels.status, filters.status));
    if (filters?.category)
        conditions.push(eq(aiModels.category, filters.category));
    if (conditions.length) {
        query = query.where(and(...conditions));
    }
    return await query.orderBy(desc(aiModels.downloads)).limit(filters?.limit || 50);
}
export async function getModelById(id) {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id)).limit(1);
    return model;
}
export async function createModel(data) {
    const [result] = await db.insert(aiModels).values({ ...data, status: "draft" }).returning();
    return { id: result.id };
}
export async function purchaseModel(data) {
    const [result] = await db.insert(modelPurchases).values({ ...data, status: "active" }).returning();
    // Increment download count
    await db.update(aiModels)
        .set({ downloads: sql `${aiModels.downloads} + 1` })
        .where(eq(aiModels.id, data.modelId));
    return { id: result.id };
}
export async function getUserPurchases(userId) {
    return await db.select().from(modelPurchases)
        .where(eq(modelPurchases.userId, userId))
        .orderBy(desc(modelPurchases.createdAt));
}
export async function addReview(data) {
    const [result] = await db.insert(modelReviews).values(data).returning();
    // Update model rating average
    const [avg] = await db.select({ avg: sql `AVG(rating)`, count: sql `COUNT(*)` })
        .from(modelReviews)
        .where(eq(modelReviews.modelId, data.modelId));
    await db.update(aiModels)
        .set({ rating: avg.avg, reviewCount: avg.count })
        .where(eq(aiModels.id, data.modelId));
    return { id: result.id };
}
export async function getModelReviews(modelId) {
    return await db.select().from(modelReviews)
        .where(eq(modelReviews.modelId, modelId))
        .orderBy(desc(modelReviews.createdAt));
}
