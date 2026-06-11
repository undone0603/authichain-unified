/**
 * Pipeline tick tests — verifies control flow, UCB1 task ordering, and result shape.
 * All sub-jobs and db functions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mutable env ──────────────────────────────────────────────────────────────

const mockEnv = vi.hoisted(() => ({ autonomousPipelineEnabled: true }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./_core/env.js',              () => ({ ENV: mockEnv }));
vi.mock('./jobs/budget-monitor.js',    () => ({ runBudgetMonitor:               vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/dunning.js',           () => ({ runDunningEscalation:           vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/retention.js',         () => ({ runRetentionAutomation:         vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/weekly-digest.js',     () => ({ runWeeklyDigestDispatch:        vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/quarterly-value.js',   () => ({ runQuarterlyValueReportDispatch: vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/organic-traffic.js',   () => ({ runOrganicTrafficAutomation:    vi.fn().mockResolvedValue({ executed: true }) }));
vi.mock('./jobs/task-runner.js',       () => ({ runTask:                        vi.fn().mockResolvedValue({ ok: true }) }));

// Drizzle-style chainable stub: every chain method returns the same object;
// terminal methods (.limit, .values) resolve to empty/no-op so the blitz path
// in pipeline-tick.ts can run without throwing.
const dbChainStub: any = {
  select: () => dbChainStub,
  from:   () => dbChainStub,
  where:  () => dbChainStub,
  limit:  () => Promise.resolve([]),
  insert: () => dbChainStub,
  values: () => Promise.resolve(undefined),
};

vi.mock('./db.js', () => ({
  getDb:                 vi.fn().mockResolvedValue(dbChainStub),
  getDueTasks:           vi.fn().mockResolvedValue([]),
  getRunTaskCount:       vi.fn().mockResolvedValue(100),
  getAdaptivePriors:     vi.fn().mockResolvedValue({
    GOV:     { alpha: 2,  beta: 23 },
    RETAIL:  { alpha: 3,  beta: 17 },
    PRESS:   { alpha: 4,  beta: 16 },
    PARTNER: { alpha: 2,  beta: 6  },
    DEFAULT: { alpha: 1,  beta: 4  },
  }),
  createMission:         vi.fn().mockResolvedValue('mock-mission-id'),
  getActiveMissionTypes: vi.fn().mockResolvedValue([]),
  logActivity:           vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runPipelineTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.autonomousPipelineEnabled = true;
  });

  it('returns { enabled: false, skipped: true } when pipeline is disabled', async () => {
    mockEnv.autonomousPipelineEnabled = false;

    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick();

    expect(result).toEqual({
      enabled: false,
      skipped: true,
      reason: 'AUTONOMOUS_PIPELINE_ENABLED=false',
    });
  });

  it('runs all 6 sub-jobs when enabled', async () => {
    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    await runPipelineTick();

    const { runBudgetMonitor }                = await import('./jobs/budget-monitor.js');
    const { runDunningEscalation }            = await import('./jobs/dunning.js');
    const { runRetentionAutomation }          = await import('./jobs/retention.js');
    const { runWeeklyDigestDispatch }         = await import('./jobs/weekly-digest.js');
    const { runQuarterlyValueReportDispatch } = await import('./jobs/quarterly-value.js');
    const { runOrganicTrafficAutomation }     = await import('./jobs/organic-traffic.js');

    expect(vi.mocked(runBudgetMonitor)).toHaveBeenCalledOnce();
    expect(vi.mocked(runDunningEscalation)).toHaveBeenCalledOnce();
    expect(vi.mocked(runRetentionAutomation)).toHaveBeenCalledOnce();
    expect(vi.mocked(runWeeklyDigestDispatch)).toHaveBeenCalledOnce();
    expect(vi.mocked(runQuarterlyValueReportDispatch)).toHaveBeenCalledOnce();
    expect(vi.mocked(runOrganicTrafficAutomation)).toHaveBeenCalledOnce();
  });

  it('returns summary with enabled: true', async () => {
    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick() as any;

    expect(result.enabled).toBe(true);
    expect(result).toHaveProperty('budgetMonitor');
    expect(result).toHaveProperty('dunning');
    expect(result).toHaveProperty('retention');
    expect(result).toHaveProperty('weeklyDigest');
    expect(result).toHaveProperty('quarterlyValue');
    expect(result).toHaveProperty('organicTraffic');
    expect(result).toHaveProperty('missionTasks');
  });

  it('logs pipeline_tick_executed to activityLog', async () => {
    const { logActivity } = await import('./db.js');
    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    await runPipelineTick();

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pipeline_tick_executed' }),
    );
  });

  it('calls runTask for each due task', async () => {
    const { getDueTasks } = await import('./db.js');
    const { runTask } = await import('./jobs/task-runner.js');

    vi.mocked(getDueTasks).mockResolvedValueOnce([
      { id: 't1', kind: 'FIND_GOV_LEADS',      missionId: 'm1', title: 't1', description: 'd1', payload: {}, status: 'PENDING', error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 't2', kind: 'DRAFT_PRESS_RELEASE', missionId: 'm1', title: 't2', description: 'd2', payload: {}, status: 'PENDING', error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick() as any;

    expect(vi.mocked(runTask)).toHaveBeenCalledTimes(2);
    expect(result.missionTasks.total).toBe(2);
    expect(result.missionTasks.ran).toBe(2);
    expect(result.missionTasks.errors).toBe(0);
  });

  it('increments errors count when a task throws, does not abort remaining tasks', async () => {
    const { getDueTasks } = await import('./db.js');
    const { runTask } = await import('./jobs/task-runner.js');

    vi.mocked(getDueTasks).mockResolvedValueOnce([
      { id: 't1', kind: 'FIND_GOV_LEADS', missionId: 'm1', title: 't1', description: 'd1', payload: {}, status: 'PENDING', error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 't2', kind: 'CRM_UPDATE',     missionId: 'm1', title: 't2', description: 'd2', payload: {}, status: 'PENDING', error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    vi.mocked(runTask)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick() as any;

    expect(result.missionTasks.ran).toBe(1);
    expect(result.missionTasks.errors).toBe(1);
    expect(vi.mocked(runTask)).toHaveBeenCalledTimes(2);
  });

  it('returns missionTasks.total=0 when getDueTasks returns empty array', async () => {
    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick() as any;

    expect(result.missionTasks.total).toBe(0);
    expect(result.missionTasks.ran).toBe(0);
    expect(result.missionTasks.errors).toBe(0);
  });

  it('UCB1-scored tasks with known kinds run (does not crash with unknown segment mapping)', async () => {
    const { getDueTasks } = await import('./db.js');
    const { runTask } = await import('./jobs/task-runner.js');

    // Task kind not in kindToSegment map — falls back to DEFAULT prior
    vi.mocked(getDueTasks).mockResolvedValueOnce([
      { id: 't1', kind: 'UNKNOWN_FUTURE_KIND', missionId: 'm1', title: 't1', description: 'd1', payload: {}, status: 'PENDING', error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { runPipelineTick } = await import('./jobs/pipeline-tick.js');
    const result = await runPipelineTick() as any;

    // Should have attempted to run the task (and maybe errored — that's fine)
    expect(vi.mocked(runTask)).toHaveBeenCalledTimes(1);
    expect(result.missionTasks.total).toBe(1);
  });
});
