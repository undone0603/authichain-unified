  import { db } from "@/db";
  import { apiUsage,subscriptions } from "@/db/schema";
  import { and,eq } from "drizzle-orm";

export class ApiUsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUsageLimitError";
  }
}

export async function checkAndIncrementUsage(userId: number): Promise<void> {
  const now = new Date();
  const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Simplistic billing start
  const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return await db.transaction(async tx => {
    // 1. Get Subscription/Quota
    const sub = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });

    if (!sub) throw new ApiUsageLimitError("No active subscription found");

    // Default quota if not specified
    const quota = sub.monthlyQuota || 100;

    // 2. Get/Create Usage Record
    let usage = await tx.query.apiUsage.findFirst({
      where: and(
        eq(apiUsage.userId, userId),
        eq(apiUsage.billingPeriodStart, billingPeriodStart)
      ),
    });

    if (!usage) {
      const [newUsage] = await tx
        .insert(apiUsage)
        .values({
          userId,
          usageCount: 0,
          billingPeriodStart,
          billingPeriodEnd,
        })
        .returning();
      usage = newUsage;
    }

    // 3. Check Limit
    if (usage.usageCount >= quota) {
      throw new ApiUsageLimitError(
        `Usage limit of ${quota} reached for this billing period`
      );
    }

    // 4. Increment
    await tx
      .update(apiUsage)
      .set({ usageCount: usage.usageCount + 1 })
      .where(eq(apiUsage.id, usage.id));
  });
}
