import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { feedback, feedbackVotes, users, InsertFeedback, InsertFeedbackVote } from "../../drizzle/schema";

/**
 * Create new feedback
 */
export async function createFeedback(data: InsertFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db.insert(feedback).values(data).returning({ id: feedback.id });
  return row!.id;
}

/**
 * Get all feedback with user info and vote counts
 */
export async function getAllFeedback() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select({
      id: feedback.id,
      userId: feedback.userId,
      userName: users.name,
      type: feedback.type,
      title: feedback.title,
      description: feedback.description,
      status: feedback.status,
      priority: feedback.priority,
      votes: feedback.votes,
      adminResponse: feedback.adminResponse,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.votes), desc(feedback.createdAt))
    .limit(500);

  return results;
}

/**
 * Get feedback by ID
 */
export async function getFeedbackById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select({
      id: feedback.id,
      userId: feedback.userId,
      userName: users.name,
      type: feedback.type,
      title: feedback.title,
      description: feedback.description,
      status: feedback.status,
      priority: feedback.priority,
      votes: feedback.votes,
      adminResponse: feedback.adminResponse,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .where(eq(feedback.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * Get feedback by user ID
 */
export async function getFeedbackByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt));

  return results;
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(
  id: number,
  status: "new" | "in_progress" | "completed" | "rejected",
  adminResponse?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(feedback)
    .set({
      status,
      adminResponse,
      updatedAt: new Date(),
    })
    .where(eq(feedback.id, id));
}

/**
 * Update feedback priority
 */
export async function updateFeedbackPriority(
  id: number,
  priority: "low" | "medium" | "high" | "critical"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(feedback)
    .set({
      priority,
      updatedAt: new Date(),
    })
    .where(eq(feedback.id, id));
}

/**
 * Vote on feedback
 */
export async function voteFeedback(feedbackId: number, userId: number, voteType: "up" | "down") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already voted
  const existingVote = await db
    .select()
    .from(feedbackVotes)
    .where(and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)))
    .limit(1);

  if (existingVote.length > 0) {
    // Update existing vote
    await db
      .update(feedbackVotes)
      .set({ voteType })
      .where(and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)));
  } else {
    // Create new vote
    await db.insert(feedbackVotes).values({
      feedbackId,
      userId,
      voteType,
    });
  }

  // Update vote count on feedback
  await recalculateVotes(feedbackId);
}

/**
 * Remove vote from feedback
 */
export async function removeVote(feedbackId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(feedbackVotes)
    .where(and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)));

  // Update vote count
  await recalculateVotes(feedbackId);
}

/**
 * Recalculate vote count for feedback
 */
async function recalculateVotes(feedbackId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const votes = await db
    .select({
      voteType: feedbackVotes.voteType,
    })
    .from(feedbackVotes)
    .where(eq(feedbackVotes.feedbackId, feedbackId));

  const upvotes = votes.filter((v) => v.voteType === "up").length;
  const downvotes = votes.filter((v) => v.voteType === "down").length;
  const totalVotes = upvotes - downvotes;

  await db.update(feedback).set({ votes: totalVotes }).where(eq(feedback.id, feedbackId));
}

/**
 * Get user's vote on feedback
 */
export async function getUserVote(feedbackId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(feedbackVotes)
    .where(and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)))
    .limit(1);

  return results[0] || null;
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const stats = await db
    .select({
      total: sql<number>`COUNT(*)`,
      new: sql<number>`SUM(CASE WHEN ${feedback.status} = 'new' THEN 1 ELSE 0 END)`,
      inProgress: sql<number>`SUM(CASE WHEN ${feedback.status} = 'in_progress' THEN 1 ELSE 0 END)`,
      completed: sql<number>`SUM(CASE WHEN ${feedback.status} = 'completed' THEN 1 ELSE 0 END)`,
      rejected: sql<number>`SUM(CASE WHEN ${feedback.status} = 'rejected' THEN 1 ELSE 0 END)`,
      bugs: sql<number>`SUM(CASE WHEN ${feedback.type} = 'bug' THEN 1 ELSE 0 END)`,
      features: sql<number>`SUM(CASE WHEN ${feedback.type} = 'feature' THEN 1 ELSE 0 END)`,
      improvements: sql<number>`SUM(CASE WHEN ${feedback.type} = 'improvement' THEN 1 ELSE 0 END)`,
    })
    .from(feedback);

  return stats[0] || null;
}
