-- Allow the Government Opportunity Digest to mark rows it has sent to the owner.
-- The digest writes email_status = 'owner_notified', but the check constraint only
-- allowed 'unsent','sent','bounced','failed', so every update was rejected and the
-- same top-50 rows were re-sent every weekday.
-- Non-destructive: widens the allowed set; existing rows are unchanged.
-- Rollback: re-add the four-value constraint (after resetting any 'owner_notified' rows to 'sent').
alter table public.gov_proposals drop constraint if exists gov_proposals_email_status_check;
alter table public.gov_proposals add constraint gov_proposals_email_status_check
  check (email_status = any (array['unsent','sent','bounced','failed','owner_notified']));
