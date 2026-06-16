export interface IEmailCampaignsRepository {
  getUserEmailCampaigns(userId: number): Promise<any[]>;
  createEmailCampaign(input: any): Promise<any>;
  updateEmailCampaign(id: number, data: any): Promise<void>;
}
