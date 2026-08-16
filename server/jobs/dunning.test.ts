import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state } = vi.hoisted(() => ({ state: { subs: [] as any[], logged: new Set<string>() } }));

const sendEmail = vi.fn(async (..._a: unknown[]) => {});
const createSystemNotification = vi.fn(async (..._a: unknown[]) => {});
const logActivity = vi.fn(async (..._a: unknown[]) => {});

vi.mock('../db', () => ({
  listPastDueSubscriptions: async () => state.subs,
  hasDunningStepLogged: async (id: number, step: string) => state.logged.has(`${id}:${step}`),
  createSystemNotification: (...a: unknown[]) => createSystemNotification(...a),
  logActivity: (...a: unknown[]) => logActivity(...a),
  getUserById: async (id: number) => ({ id, email: `u${id}@example.com`, name: 'User' }),
}));
vi.mock('../email-service', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { runDunningEscalation } from './dunning';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

beforeEach(() => {
  state.subs = [];
  state.logged = new Set();
  sendEmail.mockClear(); createSystemNotification.mockClear(); logActivity.mockClear();
});

describe('runDunningEscalation', () => {
  it('sends a day_3 reminder for a 3–6 day past-due subscription', async () => {
    state.subs = [{ id: 1, userId: 10, plan: 'starter', updatedAt: daysAgo(4) }];
    const r = await runDunningEscalation();
    expect(r.checked).toBe(1);
    expect(r.remindersSent).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing_dunning_day_3' }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('escalates to day_14 for a 14+ day past-due subscription', async () => {
    state.subs = [{ id: 2, userId: 11, plan: 'professional', updatedAt: daysAgo(20) }];
    const r = await runDunningEscalation();
    expect(r.remindersSent).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing_dunning_day_14' }));
  });

  it('is idempotent — skips a step that was already logged', async () => {
    state.subs = [{ id: 3, userId: 12, plan: 'starter', updatedAt: daysAgo(4) }];
    state.logged.add('3:day_3');
    const r = await runDunningEscalation();
    expect(r.remindersSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing for a subscription under 3 days past due', async () => {
    state.subs = [{ id: 4, userId: 13, plan: 'starter', updatedAt: daysAgo(1) }];
    const r = await runDunningEscalation();
    expect(r.remindersSent).toBe(0);
    expect(logActivity).not.toHaveBeenCalled();
  });
});
