import { describe, it, expect } from 'vitest';
import { MISSION_STATUSES, MISSION_STATUS_TO_DB, TASK_STATUSES } from './types';

/**
 * These pin the two vocabularies against the database's CHECK constraints.
 *
 * Both updateMissionStatus() implementations used to write
 * `status.toLowerCase() as any`, which looks obviously correct and is wrong
 * for three of the four values. The cast is why nothing caught it, and the
 * failure was invisible in practice because it surfaced as a [23514] inside a
 * job whose error handler records status='failed' and returns normally.
 */

/** missions_status_check, as the database enforces it. */
const MISSIONS_STATUS_CHECK = ['pending', 'active', 'blocked', 'completed', 'failed'];

/** mission_tasks_status_check, as the database enforces it. */
const MISSION_TASKS_STATUS_CHECK = ['pending', 'in_progress', 'waiting_human', 'completed', 'failed'];

describe('MISSION_STATUS_TO_DB', () => {
  it('maps every MissionStatus to a value the check constraint permits', () => {
    for (const status of MISSION_STATUSES) {
      expect(MISSION_STATUS_TO_DB[status], `${status} has no mapping`).toBeDefined();
      expect(MISSIONS_STATUS_CHECK, `${status} maps to a value missions_status_check rejects`).toContain(
        MISSION_STATUS_TO_DB[status],
      );
    }
  });

  it('is not simply lowercasing', () => {
    // The specific wrong assumption, named so a future simplification back to
    // .toLowerCase() fails here rather than in production.
    expect(MISSION_STATUS_TO_DB.PLANNED).toBe('pending');
    expect(MISSION_STATUS_TO_DB.IN_PROGRESS).toBe('active');
    expect(MISSION_STATUS_TO_DB.PLANNED).not.toBe('planned');
    expect(MISSION_STATUS_TO_DB.IN_PROGRESS).not.toBe('in_progress');
  });

  it('does not collapse BLOCKED into failed', () => {
    // A mission waiting on something has not failed, and the two must stay
    // distinguishable in the ledger.
    expect(MISSION_STATUS_TO_DB.BLOCKED).toBe('blocked');
    expect(MISSION_STATUS_TO_DB.BLOCKED).not.toBe(MISSION_STATUS_TO_DB.COMPLETED);
  });

  it('maps distinct statuses to distinct values', () => {
    const written = MISSION_STATUSES.map((s) => MISSION_STATUS_TO_DB[s]);
    expect(new Set(written).size).toBe(MISSION_STATUSES.length);
  });
});

describe('task status vocabulary', () => {
  it('permits waiting_human, which markTaskWaitingHuman writes', () => {
    // This was rejected with [23514] on every call, so a task could never be
    // parked for human review — the state send-guard.ts puts a recipient it
    // cannot verify into.
    expect(MISSION_TASKS_STATUS_CHECK).toContain('waiting_human');
  });

  it('has a TASK_STATUSES entry for every value the constraint permits', () => {
    // TASK_STATUSES is upper snake case and the column is lower; this checks
    // the two describe the same set of states rather than the same spelling.
    const declared = new Set(TASK_STATUSES.map((s) => s.toLowerCase()));
    // The enum calls them RUNNING and DONE where the column says in_progress
    // and completed, so those two are matched by hand.
    declared.delete('running');
    declared.add('in_progress');
    declared.delete('done');
    declared.add('completed');
    expect([...declared].sort()).toEqual([...MISSION_TASKS_STATUS_CHECK].sort());
  });
});
