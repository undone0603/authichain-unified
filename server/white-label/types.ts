export interface IWhiteLabelRepository {
  getWhiteLabelClients(): Promise<any[]>;
  createWhiteLabelClient(input: any): Promise<any>;
  getWhiteLabelByApiKey(apiKey: string): Promise<any>;
}
