// server/missions/db-repository.ts
// Real database-backed implementation of IMissionsRepository.
// Thin wrapper over missions.db so it can be swapped for a mock in tests
// (see server/missions.test.ts repository-injection coverage).
import * as missionsDb from "./missions.db";
import type { IMissionsRepository, MissionStatus, MissionType, MissionWithTasks } from "./types";
import type { Mission, MissionTask } from "../../drizzle/schema";

export class DbMissionsRepository implements IMissionsRepository {
  getMissions(status?: MissionStatus): Promise<Mission[]> {
    return missionsDb.getMissions(status);
  }

  getMissionById(id: string): Promise<MissionWithTasks | null> {
    return missionsDb.getMissionById(id);
  }

  createMission(type: MissionType): Promise<string> {
    return missionsDb.createMission(type);
  }

  updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
    return missionsDb.updateMissionStatus(id, status);
  }

  getTasksByMission(missionId: string): Promise<MissionTask[]> {
    return missionsDb.getTasksByMission(missionId);
  }

  retryTask(id: string): Promise<void> {
    return missionsDb.retryTask(id);
  }
}
