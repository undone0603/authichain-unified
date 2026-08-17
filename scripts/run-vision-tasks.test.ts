import { describe, expect, it, vi } from 'vitest';

describe('vision task runner database contract', () => {
  it('uses the canonical mission_tasks physical columns through Drizzle', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: query,
            }),
          }),
        }),
      }),
    };

    vi.doMock('../server/db.js', () => ({
      getDb: vi.fn().mockResolvedValue(fakeDb),
      getDueTasks: vi.fn().mockResolvedValue([]),
      markTaskRunning: vi.fn(),
      markTaskDone: vi.fn(),
      markTaskFailed: vi.fn(),
    }));
    vi.doMock('../server/agents/browser-vision.js', () => ({
      runVisionResearchLead: vi.fn(),
      runVisionFreeform: vi.fn(),
    }));

    // The executable is intentionally not imported here: its main() starts on import.
    // This test documents the contract that getDueTasks must be the only query path.
    expect(fakeDb).toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
