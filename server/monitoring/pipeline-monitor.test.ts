import { describe, expect, it } from "vitest";
import {
  formatPipelineSnapshot,
  type PipelineSnapshot,
} from "./pipeline-monitor.js";

describe("pipeline task monitor", () => {
  it("prints only database-backed task counts and failure details", () => {
    const snapshot: PipelineSnapshot = {
      sampledAt: new Date("2026-10-04T04:00:00.000Z"),
      pendingTasks: 2,
      runningTasks: 1,
      waitingHumanTasks: 3,
      completedTasks24h: 8,
      failedTasks24h: 2,
      successRate24h: 80,
      recentErrors: [
        {
          error: "provider timed out",
          updatedAt: new Date("2026-10-04T03:59:00.000Z"),
        },
      ],
    };

    const output = formatPipelineSnapshot(snapshot);

    expect(output).toContain(
      "2 pending, 1 in progress, 3 waiting for a person"
    );
    expect(output).toContain("8 completed, 2 failed, 80.0% success rate");
    expect(output).toContain("provider timed out");
    expect(output).not.toMatch(/CPU|Mem|agents active/i);
  });

  it("does not report a success rate without completed or failed tasks", () => {
    const snapshot: PipelineSnapshot = {
      sampledAt: new Date("2026-10-04T04:00:00.000Z"),
      pendingTasks: 0,
      runningTasks: 0,
      waitingHumanTasks: 0,
      completedTasks24h: 0,
      failedTasks24h: 0,
      successRate24h: null,
      recentErrors: [],
    };

    expect(formatPipelineSnapshot(snapshot)).toContain("n/a success rate");
  });
});
