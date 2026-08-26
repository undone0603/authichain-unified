-- Let the two status columns hold the values the code actually writes.
--
-- mission_tasks.status
--   markTaskWaitingHuman() (server/db.ts and server/agents/db-helpers.ts)
--   writes 'waiting_human'. mission_tasks_status_check did not permit it, so
--   the update raised [23514] every time and no task could ever be parked for
--   human review. Confirmed against the live database, not inferred: an update
--   to 'waiting_human' on a probe row returned
--
--     REJECTED [23514] new row for relation "mission_tasks" violates check
--     constraint "mission_tasks_status_check"
--
--   and no row in the table has ever held that status. This matters now
--   because parking-for-review is the mechanism server/outreach/send-guard.ts
--   relies on to hold back a recipient it cannot verify — the path that
--   carries the most weight the moment outbound email is switched on.
--
-- missions.status
--   Adds 'blocked'. Both updateMissionStatus() implementations lowercased a
--   MissionStatus ('PLANNED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED') and
--   cast the result with `as any`, producing three values the constraint
--   rejected. PLANNED and IN_PROGRESS map onto the existing 'pending' and
--   'active' in code (MISSION_STATUS_TO_DB); BLOCKED has no counterpart and is
--   added here rather than folded into 'failed', because a mission waiting on
--   something is not a mission that failed.
--
-- Both statements only ADD an allowed value. Neither can reject a row the
-- database accepts today, and every existing row satisfies the new form.
-- Validated against the live database inside a transaction that was rolled
-- back: with these in place a task accepted 'waiting_human' and a mission
-- accepted both 'blocked' and 'active'.

alter table mission_tasks drop constraint mission_tasks_status_check;
alter table mission_tasks add constraint mission_tasks_status_check
  check (status = any (array['pending', 'in_progress', 'waiting_human', 'completed', 'failed']));

alter table missions drop constraint missions_status_check;
alter table missions add constraint missions_status_check
  check (status = any (array['pending', 'active', 'blocked', 'completed', 'failed']));
