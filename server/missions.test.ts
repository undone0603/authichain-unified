import { describe, expect, it, beforeAll } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

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
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
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

// ─── Auth guards ─────────────────────────────────────────────────────────────

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
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by status', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.list({ status: 'PLANNED' });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((m: any) => expect(m.status).toBe('PLANNED'));
  });
});

// ─── missions.create + missions.get ──────────────────────────────────────────

describe('missions.create', () => {
  let missionId: string;

  it('creates a RETAIL_PILOT mission and returns an id', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.create({ type: 'RETAIL_PILOT' });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('string');
    missionId = result.id;
  });

  it('missions.get returns mission with correct type', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.get({ id: missionId }) as any;
    expect(result).not.toBeNull();
    expect(result.type).toBe('RETAIL_PILOT');
    expect(result.status).toBe('PLANNED');
  });

  it('missions.get includes seeded tasks', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.get({ id: missionId }) as any;
    expect(Array.isArray(result?.tasks)).toBe(true);
    expect(result.tasks.length).toBeGreaterThan(0);
    result.tasks.forEach((t: any) => {
      expect(t.missionId).toBe(missionId);
      expect(t.status).toBe('PENDING');
    });
  });

  it('tasks.list returns same tasks for mission', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const fromGet = (await caller.missions.get({ id: missionId }) as any)?.tasks ?? [];
    const fromList = await caller.tasks.list({ missionId });
    expect(fromList.length).toBe(fromGet.length);
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
      const caller = appRouter.createCaller(makeCtx());
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
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.create({ type: 'PARTNER_ONBOARDING' });
    missionId = result.id;
  });

  it('transitions PLANNED → IN_PROGRESS', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.updateStatus({ id: missionId, status: 'IN_PROGRESS' });
    expect(result).toEqual({ ok: true });

    const mission = await caller.missions.get({ id: missionId }) as any;
    expect(mission?.status).toBe('IN_PROGRESS');
  });

  it('transitions IN_PROGRESS → COMPLETED', async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.missions.updateStatus({ id: missionId, status: 'COMPLETED' });
    const mission = await caller.missions.get({ id: missionId }) as any;
    expect(mission?.status).toBe('COMPLETED');
  });
});

// ─── tasks.retry ─────────────────────────────────────────────────────────────

describe('tasks.retry', () => {
  let failedTaskId: string;

  beforeAll(async () => {
    // Create a mission, then manually fail one of its tasks via DB
    const { createMission, getTasksByMission, getDb } = await import('./db');
    const { missionTasks } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');

    const missionId = await createMission('TECH_OS_LOCK');
    const tasks = await getTasksByMission(missionId);
    failedTaskId = tasks[0].id;

    const db = await getDb();
    if (db) {
      await db.update(missionTasks)
        .set({ status: 'FAILED', lastError: 'test failure', updatedAt: new Date() })
        .where(eq(missionTasks.id, failedTaskId));
    }
  });

  it('retries a FAILED task — resets to PENDING', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.retry({ id: failedTaskId });
    expect(result).toEqual({ ok: true });

    const { getDb } = await import('./db');
    const { missionTasks } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const db = await getDb();
    if (db) {
      const [task] = await db.select().from(missionTasks).where(eq(missionTasks.id, failedTaskId));
      expect(task.status).toBe('PENDING');
      expect(task.lastError).toBeNull();
    }
  });

  it('retry on non-FAILED task is a no-op (status unchanged)', async () => {
    const caller = appRouter.createCaller(makeCtx());
    // Call retry on a task that is now PENDING — should be a safe no-op
    await expect(caller.tasks.retry({ id: failedTaskId })).resolves.toEqual({ ok: true });
  });
});

// ─── missions.get — non-existent ─────────────────────────────────────────────

describe('missions.get edge cases', () => {
  it('returns null for a non-existent mission id', async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.get({ id: '00000000-0000-0000-0000-000000000000' });
    expect(result).toBeNull();
  });
});
