// server/missions/db-repository.ts
// Real database-backed implementation of IMissionsRepository.
// Thin wrapper over missions.db so it can be swapped for a mock in tests
// (see server/missions.test.ts repository-injection coverage).
import * as missionsDb from "./missions.db";
import type { IMissionsRepository, MissionStatus, MissionType } from "./types";

export class DbMissionsRepository implements IMissionsRepository {
  getMissions(status?: MissionStatus): Promise<any[]> {
    return missionsDb.getMissions(status);
  }

  getMissionById(id: string): Promise<any | null> {
    return missionsDb.getMissionById(id);
  }

  createMission(type: MissionType): Promise<string> {
    return missionsDb.createMission(type);
  }

  updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
    return missionsDb.updateMissionStatus(id, status);
  }

  getTasksByMission(missionId: string): Promise<any[]> {
    return missionsDb.getTasksByMission(missionId);
  }

  retryTask(id: string): Promise<void> {
    return missionsDb.retryTask(id);
  }
}
