import * as db from "../db";
import { IEmailDraftsRepository } from "./types";

export class DbEmailDraftsRepository implements IEmailDraftsRepository {
  async getPendingDrafts(): Promise<any[]> {
    return await db.getPendingDrafts();
  }
  async createEmailDraft(data: any): Promise<any> {
    return await db.createEmailDraft(data);
  }
  async updateDraftStatus(id: number, status: string, userId: number): Promise<void> {
    await db.updateDraftStatus(id, status, userId);
  }
}
