export interface IReferralRepository {
  createReferralCode(userId: number): Promise<any>;
  getReferralStats(userId: number): Promise<any>;
  getUserReferrals(userId: number): Promise<any[]>;
  trackReferralClick(data: any): Promise<void>;
  getReferralByCode(code: string): Promise<any>;
  completeReferral(data: any): Promise<void>;
}

export interface IMarketingRepository {
  getAllLeads(): Promise<any[]>;
  createLead(input: any): Promise<any>;
  updateLeadScore(id: number, score: number): Promise<void>;
  updateLeadStatus(id: number, status: string): Promise<void>;
  generateContent(input: { type: "email" | "social" | "blog"; topic: string; targetAudience?: string }): Promise<{ content: string }>;
}
