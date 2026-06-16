import * as db from "../db";
import { IEmailCampaignsRepository } from "./types";

export class DbEmailCampaignsRepository implements IEmailCampaignsRepository {
  async getUserEmailCampaigns(userId: number): Promise<any[]> {
    return await db.getUserEmailCampaigns(userId);
  }
  async createEmailCampaign(input: any): Promise<any> {
    return await db.createEmailCampaign(input);
  }
  async updateEmailCampaign(id: number, data: any): Promise<void> {
    await db.updateEmailCampaign(id, data);
  }
}
