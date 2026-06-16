import * as db from "../db";
import * as hubspot from "../hubspot-service";
import { invokeLLM } from "../_core/llm";
import { IMarketingRepository } from "./types";

export class DbMarketingRepository implements IMarketingRepository {
  async getAllLeads(): Promise<any[]> {
    return await db.getAllLeads();
  }
  async createLead(input: any): Promise<any> {
    const result = await db.createLead(input);
    try {
      await hubspot.syncLeadToHubSpot(input);
    } catch (e) { /* HubSpot sync is best-effort */ }
    return result;
  }
  async updateLeadScore(id: number, score: number): Promise<void> {
    await db.updateLeadScore(id, score);
  }
  async updateLeadStatus(id: number, status: string): Promise<void> {
    await db.updateLeadStatus(id, status);
  }
  async generateContent(input: { type: "email" | "social" | "blog"; topic: string; targetAudience?: string }): Promise<{ content: string }> {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a marketing expert for a blockchain authentication platform. Create compelling, professional content." },
        { role: "user", content: `Create ${input.type} content about: ${input.topic}. Target: ${input.targetAudience || "enterprise decision makers"}` },
      ],
    });
    return { content: response.choices[0].message.content };
  }
}
