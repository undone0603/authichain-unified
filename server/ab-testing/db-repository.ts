import * as db from "../db";
import { IAbTestingRepository } from "./types";

export class DbAbTestingRepository implements IAbTestingRepository {
  async getAllAbTests(): Promise<any[]> {
    return await db.getAllAbTests();
  }
  async createAbTest(input: any): Promise<any> {
    return await db.createAbTest(input);
  }
}
