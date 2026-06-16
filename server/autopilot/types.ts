export interface IAutopilotRepository {
  getAutopilotConfig(): Promise<any>;
  upsertAutopilotConfig(config: any): Promise<void>;
  getRecentDecisions(limit: number): Promise<any[]>;
  createAutopilotDecision(decision: any): Promise<any>;
  logActivity(input: any): Promise<void>;
  overrideDecision(decisionId: number, userId: number, reason: string): Promise<void>;
}
