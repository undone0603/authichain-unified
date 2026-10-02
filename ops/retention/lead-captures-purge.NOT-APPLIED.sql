-- ============================================================================
-- NOT APPLIED. DRAFT ONLY. DO NOT RUN. DO NOT MOVE INTO supabase/migrations/.
-- ============================================================================
-- AE-20261002-CFD-04 | Tier 2 (8:45 list item 6b): needs Zac's go (or an
-- Advisor call recorded with an `Approval:` line). Deleting data is outside
-- Tier 0 ("no data rewrites").
--
-- Project: QRON-v2, ref nhdnkzhtadfkkluiulhs, region us-east-2. pg_cron 1.6.4
-- is installed. Checked read-only on 2026-10-02.
--
-- What it would do, daily at 04:17 UTC:
--   1. public.lead_captures: delete rows whose expires_at < now().
--      expires_at = created_at + 12 months (STORED generated column from
--      supabase/migrations/20261002124500_lead_captures_expires_at.sql), so
--      the 36 existing rows (2026-05-04 .. 2026-06-02) already carry their own
--      expiry and drop out one by one from 2027-05-04 to 2027-06-02 with no
--      separate backfill UPDATE needed.
--   2. public.automation_logs: delete lead-related log rows older than
--      12 months (workflow_name lead_captured, hubspot_sync,
--      lead_capture.db_insert — their payload holds the lead's email/name).
--      Today: 1 row (lead_captured, 2026-06-02).
--
-- CASCADE: public.lead_sequences.lead_id REFERENCES lead_captures(id)
-- ON DELETE CASCADE, so step 1 also deletes those leads' lead_sequences rows.
--
-- NOT covered (manual or a separate API follow-up):
--   * HubSpot contacts created by hubspot_sync — delete in HubSpot (UI or
--     CRM API DELETE /crm/v3/objects/contacts/{id}, or GDPR delete endpoint).
--   * n8n lead webhook (N8N_LEAD_WEBHOOK_URL) — whatever that workflow stores
--     downstream must be purged in n8n / its destination.
--   * Resend notification emails in the sales inbox (/api/book only).
--   * Apollo: lead capture no longer sends emails to Apollo (this PR); any
--     past people/match lookups are on Apollo's side.
--
-- Dry run (read-only) before scheduling:
--   select count(*) from public.lead_captures where expires_at < now();
--   select count(*) from public.automation_logs
--    where workflow_name in ('lead_captured','hubspot_sync','lead_capture.db_insert')
--      and created_at < (now() at time zone 'UTC') - interval '12 months';
--
-- Undo after scheduling (stops future runs; deleted rows are gone — restore
-- only from a Supabase backup/PITR):
--   select cron.unschedule('purge-expired-lead-captures');
--   select cron.unschedule('purge-expired-lead-automation-logs');

select cron.schedule(
  'purge-expired-lead-captures',
  '17 4 * * *',
  $$delete from public.lead_captures where expires_at < now()$$
);

select cron.schedule(
  'purge-expired-lead-automation-logs',
  '19 4 * * *',
  $$delete from public.automation_logs
     where workflow_name in ('lead_captured','hubspot_sync','lead_capture.db_insert')
       and created_at < (now() at time zone 'UTC') - interval '12 months'$$
);
