import * as db from "../db";
import * as core from "./core";
import { IReferralRepository } from "./types";

export class DbReferralRepository implements IReferralRepository {
  async createReferralCode(userId: number): Promise<any> {
    return await core.createReferralCode(userId);
  }
  async getReferralStats(userId: number): Promise<any> {
    return await core.getReferralStats(userId);
  }
  async getUserReferrals(userId: number): Promise<any[]> {
    return await db.getUserReferrals(userId);
  }
  async trackReferralClick(data: any): Promise<void> {
    await core.trackReferralClick(data);
  }
  async getReferralByCode(code: string): Promise<any> {
    return await db.getReferralByCode(code);
  }
  async completeReferral(data: any): Promise<void> {
    await core.completeReferral(data);
  }
}
