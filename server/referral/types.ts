export interface IReferralRepository {
  createReferralCode(userId: number): Promise<any>;
  getReferralStats(userId: number): Promise<any>;
  getUserReferrals(userId: number): Promise<any[]>;
  trackReferralClick(data: any): Promise<void>;
  getReferralByCode(code: string): Promise<any>;
  completeReferral(data: any): Promise<void>;
}
