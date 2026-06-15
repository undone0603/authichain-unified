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
<<<<<<< HEAD
    amount: String(data.amount),
    apy: String(data.apy),
=======
    amount: data.amount.toString(),
    apy: data.apy.toString(),
>>>>>>> origin/add-agentz-editable
    status: "active",
    rewardsEarned: "0",
    lastRewardCalculation: new Date(),
  };

  const [row] = await db.insert(stakingPositions).values(position).returning({ id: stakingPositions.id });
  return row.id;
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
<<<<<<< HEAD
  const lastCalc = new Date(position.lastRewardCalculation ?? now);
  const hoursElapsed = (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60);

  const annualReward = (Number(position.amount) * Number(position.apy)) / 10000;
=======
  const lastCalc = new Date(position.lastRewardCalculation ?? position.stakedAt);
  const hoursElapsed = (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60);

  // Calculate rewards: (amount * APY / 100 / 365 / 24) * hoursElapsed
  const annualReward = (parseFloat(position.amount) * parseFloat(position.apy ?? "0")) / 10000; // APY is in basis points (1200 = 12%)
>>>>>>> origin/add-agentz-editable
  const hourlyReward = annualReward / 365 / 24;
  const newRewards = Math.floor(hourlyReward * hoursElapsed);

  // Update position
  await db
    .update(stakingPositions)
    .set({
<<<<<<< HEAD
      rewardsEarned: String(Number(position.rewardsEarned ?? "0") + newRewards),
=======
      rewardsEarned: (parseFloat(position.rewardsEarned ?? "0") + newRewards).toString(),
>>>>>>> origin/add-agentz-editable
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

  // Mark as withdrawn — AND status='active' guard prevents double-payout on concurrent calls
  const now = new Date();
  const withdrawn = await db
    .update(stakingPositions)
    .set({
      status: "withdrawn",
      releaseAt: now,
      updatedAt: now,
    })
    .where(and(eq(stakingPositions.id, positionId), eq(stakingPositions.status, "active")))
    .returning({ id: stakingPositions.id });

  if (withdrawn.length === 0) {
    throw new Error("Staking position already withdrawn");
  }

  // Return total amount (principal + rewards)
  return {
    principal: updatedPosition.amount,
<<<<<<< HEAD
    rewards: updatedPosition.rewardsEarned,
    total: String(Number(updatedPosition.amount) + Number(updatedPosition.rewardsEarned ?? 0)),
=======
    rewards: updatedPosition.rewardsEarned ?? "0",
    total: (parseFloat(updatedPosition.amount) + parseFloat(updatedPosition.rewardsEarned ?? "0")).toString(),
>>>>>>> origin/add-agentz-editable
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

<<<<<<< HEAD
  const totalStaked = activePositions.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRewards = positions.reduce((sum, p) => sum + Number(p.rewardsEarned ?? "0"), 0);
=======
  const totalStaked = activePositions.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalRewards = 0;
>>>>>>> origin/add-agentz-editable

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
<<<<<<< HEAD
    amount: String(data.amount),
    status: data.status as any,
    metadata: data.metadata,
=======
    amount: data.amount.toString(),
    status: data.status as any,
>>>>>>> origin/add-agentz-editable
  };

  const [row] = await db.insert(transactions).values(transaction).returning({ id: transactions.id });
  return row.id;
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
<<<<<<< HEAD
    type: data.feeType,
    amount: String(data.amount),
=======
    type: data.feeType as any,
    amount: data.amount.toString(),
>>>>>>> origin/add-agentz-editable
  };

  const [row] = await db.insert(platformFees).values(fee).returning({ id: platformFees.id });
  return row.id;
}
