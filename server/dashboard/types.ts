export interface IDashboardRepository {
  getDashboardMetrics(userId: number): Promise<any>;
  getRecentActivity(limit: number): Promise<any[]>;
}

export interface IWhiteLabelRepository {
  getWhiteLabelClients(): Promise<any[]>;
  createWhiteLabelClient(input: any): Promise<any>;
  getWhiteLabelByApiKey(apiKey: string): Promise<any>;
}
