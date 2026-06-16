export interface IAffiliateRepository {
  getAffiliateByUserId(userId: number): Promise<any>;
  getAffiliateCommissions(affiliateId: number): Promise<any[]>;
  createAffiliate(data: any): Promise<any>;
  getUserReferrals(userId: number): Promise<any[]>;
}
