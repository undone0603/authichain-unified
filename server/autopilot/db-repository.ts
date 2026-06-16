import * as db from "../db";
import { IAutopilotRepository } from "./types";

export class DbAutopilotRepository implements IAutopilotRepository {
  async getAutopilotConfig(): Promise<any> {
    return await db.getAutopilotConfig();
  }
  async upsertAutopilotConfig(config: any): Promise<void> {
    await db.upsertAutopilotConfig(config);
  }
  async getRecentDecisions(limit: number): Promise<any[]> {
    return await db.getRecentDecisions(limit);
  }
  async createAutopilotDecision(decision: any): Promise<any> {
    return await db.createAutopilotDecision(decision);
  }
  async logActivity(input: any): Promise<void> {
    await db.logActivity(input);
  }
  async overrideDecision(decisionId: number, userId: number, reason: string): Promise<void> {
    const { autopilotDecisions } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    await dbInstance.update(autopilotDecisions).set({ status: "overridden", overriddenBy: userId, overrideReason: reason }).where(eq(autopilotDecisions.id, decisionId));
  }
}
