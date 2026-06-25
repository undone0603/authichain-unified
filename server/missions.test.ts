import { describe, expect, it, beforeAll } from 'vitest';
import { vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// ─── In-memory store (hoisted so vi.mock factory can access it) ───────────────

const { store } = vi.hoisted(() => ({
  store: {
    missions: new Map<string, any>(),
    tasks:    new Map<string, any>(),
  },
}));

// Task kind lists matching templates.ts exactly
const TASK_KINDS: Record<string, string[]> = {
  GOV_PILOT:          ['BUILD_PILOT_PACKET', 'DRAFT_INTEL_DOSSIER', 'FIND_GOV_LEADS', 'DRAFT_OUTBOUND_EMAIL', 'FOLLOWUP_SEQUENCE', 'CRM_UPDATE'],
  RETAIL_PILOT:       ['FINALIZE_RETAIL_SIGNAGE', 'PACKAGE_SKU_ONBOARDING', 'FIND_RETAIL_LEADS', 'DRAFT_OUTBOUND_EMAIL', 'FOLLOWUP_SEQUENCE', 'CRM_UPDATE'],
  PRESS_LAUNCH:       ['FIND_RETAIL_LEADS', 'DRAFT_PRESS_RELEASE', 'DRAFT_OUTBOUND_EMAIL', 'FOLLOWUP_SEQUENCE', 'SCHEDULE_SOCIAL_POSTS'],
  PARTNER_ONBOARDING: ['BUILD_PILOT_PACKET', 'DRAFT_OUTBOUND_EMAIL', 'FOLLOWUP_SEQUENCE', 'CRM_UPDATE'],
  TECH_OS_LOCK:       ['BUILD_PILOT_PACKET', 'DRAFT_INTEL_DOSSIER', 'GENERATE_LAUNCH_CHECKLIST'],
  LAUNCH_AUTHICHAIN:  ['CHECK_DNS_CONFIG', 'VERIFY_SSL', 'RUN_LIGHTHOUSE_AUDIT', 'GENERATE_LAUNCH_CHECKLIST', 'DRAFT_LAUNCH_EMAIL', 'DRAFT_PRESS_RELEASE', 'SCHEDULE_SOCIAL_POSTS'],
};

const TITLES: Record<string, string> = {
  GOV_PILOT:          'Government Pilot – Initial Agency',
  RETAIL_PILOT:       'Retail Pilot – Dispensary / Retail Partner',
  PRESS_LAUNCH:       'Press Launch – Media & PR Outreach',
  PARTNER_ONBOARDING: 'Partner Onboarding',
  TECH_OS_LOCK:       'Tech OS Lock – Platform Defensibility',
  LAUNCH_AUTHICHAIN:  'AuthiChain.com – Full Launch Orchestration',
};

// ─── Mock missions.db module (what the router actually imports) ───────────────

vi.mock('./missions/missions.db', () => ({
  getMissions: async (statusFilter?: string) => {
    const all = [...store.missions.values()];
    return statusFilter ? all.filter((m: any) => m.status === statusFilter) : all;
  },

  getMissionById: async (id: string) => {
    const m = store.missions.get(id);
    if (!m) return null;
    const tasks = [...store.tasks.values()].filter((t: any) => t.missionId === id);
    return { ...m, tasks };
  },

  createMission: async (type: string) => {
    const id = crypto.randomUUID();
    store.missions.set(id, {
      id, type,
      title: TITLES[type] ?? type,
      status: 'PLANNED',
      priority: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const kind of (TASK_KINDS[type] ?? [])) {
      const taskId = crypto.randomUUID();
      store.tasks.set(taskId, {
        id: taskId, missionId: id, kind, payload: {}, status: 'PENDING',
        runAt: new Date(), lastError: null, retryCount: 0, retryAfter: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    return id;
  },

  updateMissionStatus: async (id: string, status: string) => {
    const m = store.missions.get(id);
    if (m) store.missions.set(id, { ...m, status, updatedAt: new Date() });
  },

  getTasksByMission: async (missionId: string) => {
    return [...store.tasks.values()].filter((t: any) => t.missionId === missionId);
  },

  retryTask: async (id: string) => {
    const t = store.tasks.get(id);
    if (t) store.tasks.set(id, { ...t, status: 'PENDING', lastError: null, retryCount: 0, retryAfter: null, updatedAt: new Date() });
  },
}));

// ─── Mock shared db module for helpers not in missions.db ────────────────────

vi.mock('./db', () => ({
  getDb: async () => null,
  logActivity:               vi.fn().mockResolvedValue(undefined),
  createSystemNotification:  vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared test context ──────────────────────────────────────────────────────

function makeCtx(role: 'user' | 'admin' = 'user'): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'test-agentz-001',
      email: 'agentz@authichain.com',
      name: 'AgentZ Test',
      loginMethod: 'manus',
      role,
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: () => {} } as unknown as TrpcContext['res'],
  };
}

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: () => {} } as unknown as TrpcContext['res'],
  };
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

describe('missions — auth guards', () => {
  it('missions.list throws UNAUTHORIZED for unauthenticated', async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(caller.missions.list({})).rejects.toThrow();
  });

  it('missions.create throws UNAUTHORIZED for unauthenticated', async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(caller.missions.create({ type: 'GOV_PILOT' })).rejects.toThrow();
  });

  it('tasks.list throws UNAUTHORIZED for unauthenticated', async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.tasks.list({ missionId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow();
  });
});

// ─── missions.list ────────────────────────────────────────────────────────────

describe('missions.list', () => {
  it('returns an array', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by status', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.list({ status: 'PLANNED' });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((m: any) => expect(m.status).toBe('PLANNED'));
  });
});

// ─── missions.create + missions.get ──────────────────────────────────────────

describe('missions.create', () => {
  let missionId: string;

  it('creates a RETAIL_PILOT mission and returns an id', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.create({ type: 'RETAIL_PILOT' });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('string');
    missionId = result.id;
  });

  it('missions.get returns mission with correct type', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.get({ id: missionId }) as any;
    expect(result).not.toBeNull();
    expect(result.type).toBe('RETAIL_PILOT');
    expect(result.status).toBe('PLANNED');
  });

  it('missions.get includes seeded tasks', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.get({ id: missionId }) as any;
    expect(Array.isArray(result?.tasks)).toBe(true);
    expect(result.tasks.length).toBeGreaterThan(0);
    result.tasks.forEach((t: any) => {
      expect(t.missionId).toBe(missionId);
      expect(t.status).toBe('PENDING');
    });
  });

  it('tasks.list returns same tasks for mission', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const fromGet = (await caller.missions.get({ id: missionId }) as any)?.tasks ?? [];
    const fromList = await caller.tasks.list({ missionId });
    expect((fromList as any[]).length).toBe(fromGet.length);
    expect((fromList as any[]).length).toBeGreaterThan(0);
  });
});

// ─── missions.create — all types produce tasks ───────────────────────────────

describe('missions.create — task counts', () => {
  const expectedTaskCounts: Record<string, number> = {
    GOV_PILOT:          6,
    RETAIL_PILOT:       6,
    PRESS_LAUNCH:       5,
    PARTNER_ONBOARDING: 4,
    TECH_OS_LOCK:       3,
    LAUNCH_AUTHICHAIN:  7,
  };

  for (const [type, count] of Object.entries(expectedTaskCounts)) {
    it(`${type} creates ${count} tasks`, async () => {
      const caller = appRouter.createCaller(makeCtx('admin'));
      const { id } = await caller.missions.create({ type: type as any });
      const tasks = await caller.tasks.list({ missionId: id });
      expect((tasks as any[]).length).toBe(count);
    });
  }
});

// ─── missions.updateStatus ────────────────────────────────────────────────────

describe('missions.updateStatus', () => {
  let missionId: string;

  beforeAll(async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.create({ type: 'PARTNER_ONBOARDING' });
    missionId = result.id;
  });

  it('transitions PLANNED → IN_PROGRESS', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.updateStatus({ id: missionId, status: 'IN_PROGRESS' });
    expect(result).toEqual({ ok: true });

    const mission = await caller.missions.get({ id: missionId }) as any;
    expect(mission?.status).toBe('IN_PROGRESS');
  });

  it('transitions IN_PROGRESS → COMPLETED', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    await caller.missions.updateStatus({ id: missionId, status: 'COMPLETED' });
    const mission = await caller.missions.get({ id: missionId }) as any;
    expect(mission?.status).toBe('COMPLETED');
  });
});

// ─── tasks.retry ─────────────────────────────────────────────────────────────

describe('tasks.retry', () => {
  let failedTaskId: string;

  beforeAll(async () => {
    const { createMission, getTasksByMission } = await import('./missions/missions.db');
    const { getDb } = await import('./db');

    const missionId = await createMission('TECH_OS_LOCK');
    const tasks = await getTasksByMission(missionId);
    failedTaskId = tasks[0].id;

    // Directly mark the task FAILED in the in-memory store
    const t = store.tasks.get(failedTaskId);
    if (t) store.tasks.set(failedTaskId, { ...t, status: 'FAILED', lastError: 'test failure', updatedAt: new Date() });

    const db = await getDb();
    if (db) {
      // If a real DB were present, we'd update there too (won't run in mock env)
      const { missionTasks } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await (db as any).update(missionTasks)
        .set({ status: 'FAILED', lastError: 'test failure', updatedAt: new Date() })
        .where(eq(missionTasks.id, failedTaskId));
    }
  });

  it('retries a FAILED task — resets to PENDING', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.tasks.retry({ id: failedTaskId });
    expect(result).toEqual({ ok: true });

    // Verify in the in-memory store
    const task = store.tasks.get(failedTaskId);
    expect(task?.status).toBe('PENDING');
    expect(task?.lastError).toBeNull();
  });

  it('retry on a PENDING task is a safe no-op', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    await expect(caller.tasks.retry({ id: failedTaskId })).resolves.toEqual({ ok: true });
    const task = store.tasks.get(failedTaskId);
    expect(task?.status).toBe('PENDING');
  });
});

// ─── missions.get — non-existent ─────────────────────────────────────────────

describe('missions.get edge cases', () => {
  it('returns null for a non-existent mission id', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const result = await caller.missions.get({ id: '00000000-0000-0000-0000-000000000000' });
    expect(result).toBeNull();
  });
});

// ─── missions.list — status filter reflects mutations ─────────────────────────

describe('missions.list — status filtering after mutations', () => {
  it('lists IN_PROGRESS missions after status update', async () => {
    const caller = appRouter.createCaller(makeCtx('admin'));
    const { id } = await caller.missions.create({ type: 'GOV_PILOT' });
    await caller.missions.updateStatus({ id, status: 'IN_PROGRESS' });

    const inProgress = await caller.missions.list({ status: 'IN_PROGRESS' }) as any[];
    expect(inProgress.some((m: any) => m.id === id)).toBe(true);

    const planned = await caller.missions.list({ status: 'PLANNED' }) as any[];
    expect(planned.every((m: any) => m.id !== id)).toBe(true);
  });
});

describe('missions repository injection', () => {
  it('calls the injected repository instead of the database implementation', async () => {
    const mockRepo = {
      getMissions: vi.fn().mockResolvedValue([{ id: 'injected-id', type: 'TECH_OS_LOCK', status: 'COMPLETED' }]),
      getMissionById: vi.fn(),
      createMission: vi.fn(),
      createTask: vi.fn(),
      updateMissionStatus: vi.fn(),
      getTasksByMission: vi.fn(),
      retryTask: vi.fn(),
    };
    const ctx = makeCtx('admin');
    ctx.missionsRepo = mockRepo;

    const caller = appRouter.createCaller(ctx);
    const result = await caller.missions.list({});
    expect(result).toEqual([{ id: 'injected-id', type: 'TECH_OS_LOCK', status: 'COMPLETED' }]);
    expect(mockRepo.getMissions).toHaveBeenCalled();
  });
});
