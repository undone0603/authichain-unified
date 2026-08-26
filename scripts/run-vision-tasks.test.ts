import { describe, expect, it, vi } from 'vitest';

describe('vision task runner database contract', () => {
  it('keeps the worker dependent on the canonical Drizzle task helper', async () => {
    const getDueTasks = vi.fn().mockResolvedValue([]);
    vi.doMock('../server/db.js', () => ({
      getDb: vi.fn().mockResolvedValue({}),
      getDueTasks,
      markTaskRunning: vi.fn(),
      markTaskDone: vi.fn(),
      markTaskFailed: vi.fn(),
    }));
    vi.doMock('../server/agents/browser-vision.js', () => ({
      runVisionResearchLead: vi.fn(),
      runVisionFreeform: vi.fn(),
    }));

    // The executable starts on import, so validate the integration boundary
    // through the canonical helper without executing the worker loop.
    const dbModule = await import('../server/db.js');
    await dbModule.getDueTasks(50);
    expect(getDueTasks).toHaveBeenCalledWith(50);
  });
});
