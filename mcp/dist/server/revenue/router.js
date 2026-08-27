import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { payments, subscriptions } from "../../src/db/schema";
export const revenueRouter = router({
    getMetrics: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db)
            return { mrr: 0, newSubscribers: 0, churn: 0 };
        // Basic aggregation: Monthly Revenue (sum of completed payments in last 30 days)
        const revenueData = await db
            .select({
            total: sql `sum(${payments.amount})`
        })
            .from(payments)
            .where(sql `${payments.status} = 'completed' AND ${payments.createdAt} > NOW() - INTERVAL '30 days'`);
        // Basic aggregation: Active Subscriptions
        const subData = await db
            .select({
            count: sql `count(*)`
        })
            .from(subscriptions)
            .where(sql `${subscriptions.status} = 'active'`);
        return {
            mrr: Number(revenueData[0]?.total || 0),
            activeSubscribers: Number(subData[0]?.count || 0),
        };
    }),
});
