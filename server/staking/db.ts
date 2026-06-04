import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { stakingPositions, platformFees, transactions, InsertStakingPosition, InsertPlatformFee, InsertTransaction } from "../../drizzle/schema";

export async function getUserStakingPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.userId, userId))
    .orderBy(desc(stakingPositions.createdAt));
}

export async function getActiveStakingPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(stakingPositions)
    .where(and(eq(stakingPositions.userId, userId), eq(stakingPositions.status, "active")))
    .orderBy(desc(stakingPositions.createdAt));
}

export async function createStakingPosition(data: {
  userId: number;
  amount: number;
  apy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const position: InsertStakingPosition = {
    userId: data.userId,
    amount: data.amount,
    apy: data.apy,
    status: "active",
    rewardsEarned: 0,
    lastRewardCalculation: new Date(),
  };

  const [row] = await db.insert(stakingPositions).values(position).returning({ id: stakingPositions.id });
  return row.id;
}

export async function calculateRewards(positionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const positions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.id, positionId))
    .limit(1);

  if (positions.length === 0) throw new Error("Staking position not found");

  const position = positions[0];
  if (position.status !== "active") return 0;

  const now = new Date();
  const lastCalc = position.lastRewardCalculation ?? position.stakedAt;
  const hoursElapsed = (now.getTime() - new Date(lastCalc).getTime()) / (1000 * 60 * 60);

  // Rewards: (amount * APY% / 100) / 365 / 24 * hoursElapsed
  const amount = parseFloat(String(position.amount));
  const apy = parseFloat(String(position.apy));
  const earned = parseFloat(String(position.rewardsEarned ?? "0"));
  const hourlyReward = (amount * apy) / 100 / 365 / 24;
  const newRewards = hourlyReward * hoursElapsed;

  await db
    .update(stakingPositions)
    .set({
      rewardsEarned: String(earned + newRewards),
      lastRewardCalculation: now,
      updatedAt: now,
    })
    .where(eq(stakingPositions.id, positionId));

  return newRewards;
}

export async function withdrawStaking(positionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const positions = await db
    .select()
    .from(stakingPositions)
    .where(and(eq(stakingPositions.id, positionId), eq(stakingPositions.userId, userId)))
    .limit(1);

  if (positions.length === 0) throw new Error("Staking position not found");
  if (positions[0].status !== "active") throw new Error("Position is not active");

  await calculateRewards(positionId);

  const [updated] = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.id, positionId))
    .limit(1);

  await db
    .update(stakingPositions)
    .set({ status: "withdrawn", releaseAt: new Date(), updatedAt: new Date() })
    .where(eq(stakingPositions.id, positionId));

  return {
    principal: parseFloat(String(updated.amount)),
    rewards: parseFloat(String(updated.rewardsEarned ?? "0")),
    total: parseFloat(String(updated.amount)) + parseFloat(String(updated.rewardsEarned ?? "0")),
  };
}

export async function getUserStakingStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalStaked: 0, totalRewards: 0, activePositions: 0, totalPositions: 0 };

  const positions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.userId, userId));

  const activePositions = positions.filter((p) => p.status === "active");
  const totalStaked = activePositions.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const totalRewards = positions.reduce((s, p) => s + parseFloat(String(p.rewardsEarned ?? "0")), 0);

  return {
    totalStaked,
    totalRewards,
    activePositions: activePositions.length,
    totalPositions: positions.length,
  };
}

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
    feeAmount: data.feeAmount ?? 0,
    stakingId: data.stakingId,
    metadata: data.metadata,
  };

  const [row] = await db.insert(transactions).values(transaction).returning({ id: transactions.id });
  return row.id;
}

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

  const [row] = await db.insert(platformFees).values(fee).returning({ id: platformFees.id });
  return row.id;
}
