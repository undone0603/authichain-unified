// server/missions/db-repository.ts
// Real database-backed implementation of IMissionsRepository.
// Thin wrapper over missions.db so it can be swapped for a mock in tests
// (see server/missions.test.ts repository-injection coverage).
import * as missionsDb from "./missions.db";
export class DbMissionsRepository {
    getMissions(status) {
        return missionsDb.getMissions(status);
    }
    getMissionById(id) {
        return missionsDb.getMissionById(id);
    }
    createMission(type) {
        return missionsDb.createMission(type);
    }
    updateMissionStatus(id, status) {
        return missionsDb.updateMissionStatus(id, status);
    }
    getTasksByMission(missionId) {
        return missionsDb.getTasksByMission(missionId);
    }
    retryTask(id) {
        return missionsDb.retryTask(id);
    }
}
