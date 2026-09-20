-- Give every mission_task a kind, then require one.
--
-- Five rows created in June 2026 have kind = NULL. runTask() rejects them with
-- "Unknown task kind: null", so they have been permanently unrunnable. They are
-- already status='failed' and getDueTasks() only selects 'pending', so they
-- block nothing — but a task that can never run is exactly the silent-dead-row
-- failure this codebase keeps getting bitten by, and the constraint below stops
-- another one being created.
--
-- src/db/schema.ts already declares kind .notNull(), so Drizzle's insert type
-- requires it and `tsc --noEmit` passes across all 13 insert sites. The type
-- checker is therefore already enforcing this on every code path; the database
-- is the half that disagreed. This is the nullability-drift finding that
-- scripts/check-schema-drift.mjs reports as advisory.
--
-- ── The five rows, in two groups ─────────────────────────────────────────────
--
-- Two are recoverable. enqueueTask() writes `title: kind`, so their title still
-- holds the real TaskKind and the value can be restored exactly rather than
-- guessed:
--
--   FIND_LUXURY_LEADS      payload {"icp": "Head of Brand Protection …"}
--   DRAFT_OUTBOUND_EMAIL   payload {"segment": "LUXURY", "sequence": 1}
--
-- Three are not. Their titles are prose ("Outreach", "Sentinel Sweep",
-- "Execute Outreach") and their payloads carry a `workflowId`
-- (linkedin_outreach, sentinel_threat_hunting, outreach_blitz) — n8n workflow
-- invocations from an earlier design, with no TaskKind equivalent. They are
-- labelled rather than deleted: the label is honest about what they are, keeps
-- which mission attempted what, and if one were ever re-queued runTask() would
-- say "Unknown task kind: LEGACY_WORKFLOW_INVOCATION", which is a better
-- message than "null".
--
-- ── Deliberately NOT re-queued ───────────────────────────────────────────────
--
-- All five stay status='failed'. Recovering a kind makes the row coherent; it
-- does not make a June task worth running in August. DRAFT_OUTBOUND_EMAIL in
-- particular would attempt cold outreach against two-month-old lead context.
-- Re-arming any of them is a separate, deliberate decision.
--
-- Their error text is rewritten because "Unknown task kind: null" stops being
-- true the moment the backfill lands, and leaving it would misdescribe the row.
--
-- Validated against the live database inside a transaction that was rolled
-- back: 2 recovered, 3 labelled, 0 left null, the constraint applied, and an
-- insert omitting kind was then rejected with 23502.

update mission_tasks
   set kind = title,
       error = 'kind was NULL when this ran (2026-06); recovered from title on 2026-08-21, not re-queued'
 where kind is null
   and title in (
     'FIND_GOV_LEADS', 'FIND_RETAIL_LEADS', 'FIND_LUXURY_LEADS', 'FIND_PHARMA_LEADS',
     'FIND_MEDTECH_LEADS', 'FIND_TIMEPIECE_LEADS', 'MONITOR_NEWS_FOR_PR', 'DRAFT_OUTBOUND_EMAIL',
     'BUILD_PILOT_PACKET', 'DRAFT_INTEL_DOSSIER', 'FOLLOWUP_SEQUENCE', 'CRM_UPDATE',
     'DRAFT_LAUNCH_EMAIL', 'DRAFT_PRESS_RELEASE', 'SCHEDULE_SOCIAL_POSTS', 'CHECK_REPLIES',
     'SEND_DEMO_PACKET', 'GENERATE_PROPOSAL', 'SEND_CONTRACT', 'AUTO_REPLY', 'SECURITY_AUDIT'
   );

update mission_tasks
   set kind = 'LEGACY_WORKFLOW_INVOCATION',
       error = 'n8n workflow invocation with no TaskKind equivalent; labelled on 2026-08-21, not runnable'
 where kind is null
   and payload ? 'workflowId';

alter table mission_tasks alter column kind set not null;
