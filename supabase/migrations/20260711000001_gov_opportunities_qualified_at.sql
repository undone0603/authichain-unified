-- Track lead qualification independently of the opportunity lifecycle status.
-- qualify-leads.ts previously tried to set status='qualified', which (a) violated
-- gov_opportunities_status_check and (b) would have starved generate-proposals.ts,
-- which consumes status='scored'.
ALTER TABLE gov_opportunities
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

COMMENT ON COLUMN gov_opportunities.qualified_at IS
  'Set by scripts/qualify-leads.ts when the opportunity has been converted into a leads-table entry. Orthogonal to status.';
