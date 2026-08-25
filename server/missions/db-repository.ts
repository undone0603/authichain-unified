// server/missions/db-repository.ts
// Real database-backed implementation of IMissionsRepository.
// Thin wrapper over missions.db so it can be swapped for a mock in tests
// (see server/missions.test.ts repository-injection coverage).
import * as missionsDb from "./missions.db";
import type { IMissionsRepository, MissionStatus, MissionType } from "./types";
import { getDb, type getHyperdriveDb } from "../db";

type Db = ReturnType<typeof getHyperdriveDb>;

export class DbMissionsRepository implements IMissionsRepository {
  // Optional: callers that already have a threaded `db` (e.g. a future
  // ctx.db-aware caller) can inject it directly. server/_core/context.ts
  // (out of scope for this migration — Task 1/2 territory) still
  // instantiates this with zero args, so the constructor — and therefore
  // resolveDb() below — must keep working without one. Until context.ts
  // is wired up to pass a real per-request db, this falls back to the
  // legacy getDb() singleton as a documented bridge.
  constructor(private readonly injectedDb?: Db) {}

  private async resolveDb(): Promise<Db> {
    if (this.injectedDb) return this.injectedDb;
    return getDb();
  }

  async getMissions(status?: MissionStatus): Promise<any[]> {
    const db = await this.resolveDb();
    return missionsDb.getMissions(db, status);
  }

  async getMissionById(id: string): Promise<any | null> {
    const db = await this.resolveDb();
    return missionsDb.getMissionById(db, id);
  }

  async createMission(type: MissionType): Promise<string> {
    const db = await this.resolveDb();
    return missionsDb.createMission(db, type);
  }

  async updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
    const db = await this.resolveDb();
    return missionsDb.updateMissionStatus(db, id, status);
  }

  async getTasksByMission(missionId: string): Promise<any[]> {
    const db = await this.resolveDb();
    return missionsDb.getTasksByMission(db, missionId);
  }

  async retryTask(id: string): Promise<void> {
    const db = await this.resolveDb();
    return missionsDb.retryTask(db, id);
  }
}
