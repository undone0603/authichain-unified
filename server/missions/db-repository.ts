import {
  getMissions,
  getMissionById,
  createMission,
  updateMissionStatus,
  getTasksByMission,
  retryTask,
  createTask
} from "./missions.db";
import { IMissionsRepository, MissionType, MissionStatus } from "./types";

export class DbMissionsRepository implements IMissionsRepository {
  async getMissions(statusFilter?: string): Promise<any[]> {
    return getMissions(statusFilter);
  }

  async getMissionById(id: string): Promise<any> {
    return getMissionById(id);
  }

  async createMission(type: MissionType): Promise<string> {
    return createMission(type);
  }

  async createTask(data: any): Promise<string> {
    return createTask(data);
  }

  async updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
    return updateMissionStatus(id, status);
  }

  async getTasksByMission(missionId: string): Promise<any[]> {
    return getTasksByMission(missionId);
  }

  async retryTask(id: string): Promise<void> {
    return retryTask(id);
  }
}
