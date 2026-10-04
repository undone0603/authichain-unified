import { describe, expect, it } from "vitest";
import {
  formatPipelineSnapshot,
  type PipelineSnapshot,
} from "./pipeline-monitor.js";

describe("pipeline task monitor", () => {
  it("prints database-backed counts and oldest ages without task content", () => {
    const snapshot: PipelineSnapshot = {
      sampledAt: new Date("2026-10-04T04:00:00.000Z"),
      pendingTasks: 2,
      runningTasks: 1,
      waitingHumanTasks: 3,
      oldestPendingAgeHours: 2,
      oldestRunningAgeHours: 1,
      oldestWaitingHumanAgeHours: 3,
      completedTasks24h: 8,
      failedTasks24h: 2,
      successRate24h: 80,
    };

    const output = formatPipelineSnapshot(snapshot);

    expect(output).toContain(
      "2 pending, 1 in progress, 3 waiting for a person"
    );
    expect(output).toContain("8 completed, 2 failed, 80.0% success rate");
    expect(output).toContain(
      "Oldest task ages: pending 2.0h, in progress 1.0h, waiting for a person 3.0h"
    );
    expect(output).toContain("2 failed task(s)");
    expect(output).not.toMatch(/CPU|Mem|agents active|provider timed out/i);
  });

  it("does not report a success rate or task age when there is no data", () => {
    const snapshot: PipelineSnapshot = {
      sampledAt: new Date("2026-10-04T04:00:00.000Z"),
      pendingTasks: 0,
      runningTasks: 0,
      waitingHumanTasks: 0,
      oldestPendingAgeHours: null,
      oldestRunningAgeHours: null,
      oldestWaitingHumanAgeHours: null,
      completedTasks24h: 0,
      failedTasks24h: 0,
      successRate24h: null,
    };

    const output = formatPipelineSnapshot(snapshot);
    expect(output).toContain("n/a success rate");
    expect(output).toContain(
      "Oldest task ages: pending none, in progress none, waiting for a person none"
    );
  });
});
