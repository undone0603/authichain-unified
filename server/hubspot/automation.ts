import { eq } from "drizzle-orm";
import { syncPaymentToHubSpot, createDeal, isHubSpotConfigured } from "../hubspot-service";
import * as db from "../db";
import { protocolAgents } from "../../drizzle/schema";

const SCAN_THRESHOLD = 50;
const XP_THRESHOLD = 500;

/**
 * Checks if a user has crossed a milestone threshold and triggers HubSpot deal creation.
 * This identifies high-value users (Brand Guardians) for sales outreach.
 */
export async function checkUserMilestones(userId: number) {
  if (!isHubSpotConfigured()) return;

  try {
    const user = await db.getUserById(userId);
    if (!user) return;

    // 1. Check Scan Count Threshold (from all QR codes owned by user)
    const metrics = await db.getDashboardMetrics(userId);
    // Note: getDashboardMetrics returns totals. For individual product scans, we'd need more detail,
    // but total authentications is a good proxy for "High Activity".
    if (metrics.totalAuthentications >= SCAN_THRESHOLD) {
      const alreadyLogged = await db.hasUserActionLogged(userId, "hubspot_milestone_scans");
      if (!alreadyLogged) {
        await createDeal({
          dealname: `High-Activity User: ${user.email} (${metrics.totalAuthentications} scans)`,
          amount: "999", // Enterprise potential
          dealstage: "appointmentscheduled",
        });
        await db.logActivity({ userId, action: "hubspot_milestone_scans", details: { count: metrics.totalAuthentications } });
        console.log(`[HubSpot Automation] High-activity deal created for ${user.email}`);
      }
    }

    // 2. Check Reputation/XP Threshold (from Protocol Agent)
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const [agent] = await dbInstance.select().from(protocolAgents).where(eq(protocolAgents.userId, userId)).limit(1);
    if (agent && (agent.xp || 0) >= XP_THRESHOLD) {
      const alreadyLogged = await db.hasUserActionLogged(userId, "hubspot_milestone_reputation");
      if (!alreadyLogged) {
        await createDeal({
          dealname: `Power Agent: ${user.email} (${agent.xp} XP)`,
          amount: "2499", // White-label potential
          dealstage: "appointmentscheduled",
        });
        await db.logActivity({ userId, action: "hubspot_milestone_reputation", details: { xp: agent.xp } });
        console.log(`[HubSpot Automation] Power agent deal created for ${user.email}`);
      }
    }
  } catch (error) {
    console.error("[HubSpot Automation] Error checking milestones:", error);
  }
}
