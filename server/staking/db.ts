import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { stakingPositions, platformFees, transactions, InsertStakingPosition, InsertPlatformFee, InsertTransaction } from "../../drizzle/schema";

/**
 * Get user's staking positions
 */
export async function getUserStakingPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.userId, userId))
    .orderBy(desc(stakingPositions.createdAt));
}

/**
 * Get active staking positions for a user
 */
export async function getActiveStakingPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(stakingPositions)
    .where(
      and(
        eq(stakingPositions.userId, userId),
        eq(stakingPositions.status, "active")
      )
    )
    .orderBy(desc(stakingPositions.createdAt));
}

/**
 * Create a new staking position
 */
export async function createStakingPosition(data: {
  userId: number;
  amount: number;
  apy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const position: InsertStakingPosition = {
    userId: data.userId,
    amount: String(data.amount),
    apy: String(data.apy),
    status: "active",
    rewardsEarned: "0",
    lastRewardCalculation: new Date(),
  };

  await db.insert(stakingPositions).values(position);
  return 0; // Return placeholder ID
}

/**
 * Calculate and update rewards for a staking position
 */
export async function calculateRewards(positionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get position
  const positions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.id, positionId))
    .limit(1);

  if (positions.length === 0) {
    throw new Error("Staking position not found");
  }

  const position = positions[0];

  if (position.status !== "active") {
    return 0;
  }

  // Calculate time elapsed since last calculation
  const now = new Date();
  const lastCalc = new Date(position.lastRewardCalculation ?? now);
  const hoursElapsed = (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60);

  const annualReward = (Number(position.amount) * Number(position.apy)) / 10000;
  const hourlyReward = annualReward / 365 / 24;
  const newRewards = Math.floor(hourlyReward * hoursElapsed);

  // Update position
  await db
    .update(stakingPositions)
    .set({
      rewardsEarned: String(Number(position.rewardsEarned ?? "0") + newRewards),
      lastRewardCalculation: now,
      updatedAt: now,
    })
    .where(eq(stakingPositions.id, positionId));

  return newRewards;
}

/**
 * Withdraw from staking position
 */
export async function withdrawStaking(positionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get position
  const positions = await db
    .select()
    .from(stakingPositions)
    .where(
      and(
        eq(stakingPositions.id, positionId),
        eq(stakingPositions.userId, userId)
      )
    )
    .limit(1);

  if (positions.length === 0) {
    throw new Error("Staking position not found");
  }

  const position = positions[0];

  if (position.status !== "active") {
    throw new Error("Position is not active");
  }

  // Calculate final rewards
  await calculateRewards(positionId);

  // Get updated position
  const updatedPositions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.id, positionId))
    .limit(1);

  const updatedPosition = updatedPositions[0];

  // Mark as withdrawn
  const now = new Date();
  await db
    .update(stakingPositions)
    .set({
      status: "withdrawn",
      endDate: now,
      updatedAt: now,
    })
    .where(eq(stakingPositions.id, positionId));

  // Return total amount (principal + rewards)
  return {
    principal: updatedPosition.amount,
    rewards: updatedPosition.rewardsEarned,
    total: updatedPosition.amount + updatedPosition.rewardsEarned,
  };
}

/**
 * Get total staking statistics for a user
 */
export async function getUserStakingStats(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalStaked: 0,
      totalRewards: 0,
      activePositions: 0,
      totalPositions: 0,
    };
  }

  const positions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.userId, userId));

  const activePositions = positions.filter((p) => p.status === "active");

  const totalStaked = activePositions.reduce((sum, p) => sum + p.amount, 0);
  const totalRewards = positions.reduce((sum, p) => sum + p.rewardsEarned, 0);

  return {
    totalStaked,
    totalRewards,
    activePositions: activePositions.length,
    totalPositions: positions.length,
  };
}

/**
 * Create a transaction record
 */
export async function createTransaction(data: {
  userId: number;
  type: string;
  amount: number;
  status: string;
  feeAmount?: number;
  stakingId?: number;
  metadata?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const transaction: InsertTransaction = {
    userId: data.userId,
    type: data.type as any,
    amount: data.amount,
    status: data.status as any,
    feeAmount: data.feeAmount || 0,
    stakingId: data.stakingId,
    metadata: data.metadata,
  };

  await db.insert(transactions).values(transaction);
  return 0; // Return placeholder ID
}

/**
 * Create a platform fee record
 */
export async function createPlatformFee(data: {
  feeType: string;
  percentage: number;
  amount: number;
  transactionId?: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const fee: InsertPlatformFee = {
    feeType: data.feeType,
    percentage: data.percentage,
    amount: data.amount,
    transactionId: data.transactionId,
    description: data.description,
  };

  await db.insert(platformFees).values(fee);
  return 0; // Return placeholder ID
}
