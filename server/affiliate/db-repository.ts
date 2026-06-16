import * as db from "../db";
import { IAffiliateRepository } from "./types";

export class DbAffiliateRepository implements IAffiliateRepository {
  async getAffiliateByUserId(userId: number): Promise<any> {
    return await db.getAffiliateByUserId(userId);
  }
  async getAffiliateCommissions(affiliateId: number): Promise<any[]> {
    return await db.getAffiliateCommissions(affiliateId);
  }
  async createAffiliate(data: any): Promise<any> {
    return await db.createAffiliate(data);
  }
  async getUserReferrals(userId: number): Promise<any[]> {
    return await db.getUserReferrals(userId);
  }
}
