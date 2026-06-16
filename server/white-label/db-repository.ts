import * as db from "../db";
import { IWhiteLabelRepository } from "./types";

export class DbWhiteLabelRepository implements IWhiteLabelRepository {
  async getWhiteLabelClients(): Promise<any[]> {
    return await db.getWhiteLabelClients();
  }
  async createWhiteLabelClient(input: any): Promise<any> {
    return await db.createWhiteLabelClient(input);
  }
  async getWhiteLabelByApiKey(apiKey: string): Promise<any> {
    return await db.getWhiteLabelByApiKey(apiKey);
  }
}
