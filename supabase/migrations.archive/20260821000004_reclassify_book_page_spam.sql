-- Take five non-prospects out of demo_requested.
--
-- Every lead in the funnel marked demo_requested arrived through the /book page
-- form, which stamps that status on any submission. None of the five is a
-- prospect, so the funnel has been reporting five demo requests and zero real
-- ones. That is a reporting problem rather than a data-integrity one, but the
-- standing rule here is that numbers should not overstate what happened.
--
-- ── Four bot submissions ─────────────────────────────────────────────────────
-- ids 288, 329, 338, 339. Each has the same signature:
--   * message is a bare 10-digit number and nothing else
--   * random-consonant name and "<random> LLC" company
--   * dotted Gmail alias (e.r.a.c.umus58@, la.n.ey.e.fe3.7@, …)
--
-- ── One vendor solicitation ──────────────────────────────────────────────────
-- id 289, Hannah Melotto of Melotto Group. Real person, real company domain,
-- prose message pitching website redesign services with their own booking link.
-- Labelled separately from the bots on purpose: it is unsolicited sales, not
-- fraud, and calling a real person's outreach "spam" in our own records would
-- be less accurate than saying what it was.
--
-- ── Why this is reversible ───────────────────────────────────────────────────
-- Nothing is deleted. Each row keeps its original message and gains
-- previous_status, disqualified_reason and disqualified_at in metadata, so the
-- change can be read, audited, or undone:
--
--   update leads set status = metadata->>'previous_status'
--    where metadata ? 'previous_status';
--
-- ── Not a fix for the intake ─────────────────────────────────────────────────
-- This is historical cleanup only. The bot submissions all predate the
-- detection added in #665 on 2026-08-16 (newest is 2026-08-15), and nothing has
-- got through since, so no guard needs changing. The vendor solicitation is a
-- human filling in a public form correctly; no filter should be expected to
-- catch that.
--
-- Ids are pinned rather than matched by pattern: this is a one-off correction
-- to five known rows, and a heuristic that ran later against different data
-- could disqualify a real lead. Both statements also require the row to still
-- be demo_requested, so re-running this migration changes nothing.
--
-- Validated against the live database inside a transaction that was rolled
-- back: 4 + 1 rows updated, demo_requested left at 0, provenance and original
-- message intact.

update leads
   set status = 'disqualified',
       metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'disqualified_reason', 'bot_submission',
         'disqualified_at', now()::text,
         'previous_status', status
       ),
       updated_at = now()
 where id in (288, 329, 338, 339)
   and status = 'demo_requested';

update leads
   set status = 'disqualified',
       metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'disqualified_reason', 'vendor_solicitation',
         'disqualified_at', now()::text,
         'previous_status', status
       ),
       updated_at = now()
 where id = 289
   and status = 'demo_requested';
