# Lead Scoring & Qualification Integration Checklist

## Files Created/Updated

- ✅ `/scripts/score-opportunities.ts` (UPDATED)
  - Added fit_score thresholds (70, 60)
  - Added recommended_action='qualify' for borderline (60-69)
  
- ✅ `/scripts/qualify-leads.ts` (NEW)
  - Converts fit_score >= 70 into qualified leads
  - Generates 4-dimension lead_score_detail
  - Creates/upserts entries in leads table
  
- ✅ `/scripts/email-proposals.ts` (EXISTING - ENHANCED)
  - Already sends proposals via Resend with HTML templates
  - NOW queries leads table (gov_engine source) instead of gov_proposals
  - Updated to include fit_score breakdown in email body
  - Tracks lastContactedAt and status='contacted'
  - Note: existing schema uses email_status='unsent/sent' and contact_email field
  
- ✅ `/drizzle/migrations/015_lead_scoring_pipeline.sql` (NEW)
  - Adds qualified_at to gov_opportunities
  - Adds threadId to leads
  - Creates indexes for efficient queries
  
- ✅ `/docs/gov-engine-lead-pipeline.md` (NEW)
  - Complete architecture & workflow guide
  - SQL query examples
  - Testing & monitoring instructions

---

## Implementation Steps

### 1. Apply Database Migration

```bash
# Option A: Via Supabase CLI (local dev)
supabase migration up

# Option B: Via MCP (direct to Supabase project)
# (Use your Claude Code session to run the migration manually:)
# CREATE INDEX IF NOT EXISTS gov_opportunities_status_fit_score_idx ...
```

### 2. Update GitHub Actions Workflow

Add to `.github/workflows/gov-engine.yml` after `score-opportunities.ts` step:

```yaml
- name: Qualify High-Fit Leads (fit_score ≥ 70)
  run: pnpm tsx scripts/qualify-leads.ts
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

- name: Send Proposal Emails to Qualified Leads
  run: pnpm tsx scripts/email-proposals.ts
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
    GOVCHAIN_URL: ${{ secrets.GOVCHAIN_URL }}
```

### 3. Test Scripts Locally

```bash
# Install dependencies (if needed)
pnpm install

# Test score-opportunities (existing)
DRY_RUN=true pnpm tsx scripts/score-opportunities.ts

# Test qualify-leads (new)
DRY_RUN=true pnpm tsx scripts/qualify-leads.ts

# Test email-proposals (new)
DRY_RUN=true pnpm tsx scripts/email-proposals.ts

# Full pipeline (dry run)
DRY_RUN=true pnpm tsx scripts/score-opportunities.ts && \
DRY_RUN=true pnpm tsx scripts/qualify-leads.ts && \
DRY_RUN=true pnpm tsx scripts/generate-proposals.ts && \
DRY_RUN=true pnpm tsx scripts/email-proposals.ts
```

### 4. Verify Email Service Configuration

Ensure `server/email-service.ts` is properly configured:

```bash
# Check environment variables
echo $RESEND_API_KEY          # Should not be empty
echo $GMAIL_FROM_EMAIL        # Fallback SMTP
echo $GMAIL_APP_PASSWORD      # Fallback SMTP
```

If using Resend (recommended):
- [ ] Resend API key set in `.env`
- [ ] From email configured in Resend
- [ ] Domain verified in Resend (for production)

If using Gmail (fallback):
- [ ] Gmail address configured
- [ ] App password (not regular password) set
- [ ] Less secure app access enabled (if not using app password)

### 5. Configure Suppression List

Edit `.env`:
```bash
SUPPRESSION_LIST=test@example.com,internal@authichain.us,noreply@example.com
```

Or set as GitHub Secret:
```yaml
SUPPRESSION_LIST: ${{ secrets.SUPPRESSION_LIST }}
```

### 6. Test with Real Data

**Create a test opportunity manually:**

```sql
-- Insert a test opportunity
INSERT INTO gov_opportunities (
  notice_id, title, agency, deadline, description, 
  status, fit_score, ai_reasoning, key_requirements, 
  recommended_action, scored_at
) VALUES (
  'TEST-LEAD-001',
  'Test Vehicle Authentication',
  'Department of Testing',
  '2026-08-01',
  'Test opportunity for blockchain authentication system',
  'scored',
  75,
  'Strong blockchain/supply chain fit; testing department is good buyer.',
  '["Blockchain auth", "NFT compliance"]'::jsonb,
  'pursue',
  now()
);

-- Run qualify-leads in dry-run
DRY_RUN=true pnpm tsx scripts/qualify-leads.ts

-- Verify dry-run output
-- Should show: ✅ Qualified: Test Vehicle Authentication (75/100)
```

**Then run for real:**
```bash
pnpm tsx scripts/qualify-leads.ts

# Verify lead was created
SELECT email, company, leadScore, status FROM leads 
WHERE source = 'gov_engine' AND notice_id = 'TEST-LEAD-001';
```

**Send test email:**
```bash
pnpm tsx scripts/email-proposals.ts
# (Will send to test@... email, check inbox)
```

### 7. Monitor First Run

After deploying, monitor:

```bash
# Check scoring results
SELECT status, COUNT(*) as count, 
       AVG(fit_score) as avg_fit,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fit_score) as median_fit
FROM gov_opportunities
GROUP BY status;

# Check lead qualification
SELECT COUNT(*) as total_qualified, 
       AVG(leadScore) as avg_score,
       COUNT(DISTINCT company) as unique_agencies
FROM leads
WHERE source = 'gov_engine' AND status = 'qualified';

# Check email outreach
SELECT COUNT(*) as emails_sent,
       SUM(CASE WHEN emailOpened THEN 1 ELSE 0 END) as opened,
       SUM(CASE WHEN emailReplied THEN 1 ELSE 0 END) as replied
FROM leads
WHERE source = 'gov_engine' AND lastContactedAt IS NOT NULL;
```

### 8. Set Up Alerts (Optional)

Monitor email quota usage:
```bash
# After sending, check Resend dashboard or:
SELECT COUNT(*) as emails_sent_today
FROM leads
WHERE source = 'gov_engine' 
  AND lastContactedAt >= now() - interval '1 day'
  AND status = 'contacted';

# Alert if > 80 emails (adjust based on your quota)
```

---

## Configuration Summary

### Environment Variables Required

| Variable | Source | Purpose | Required |
|----------|--------|---------|----------|
| `SUPABASE_URL` | Supabase | Database URL | ✅ Yes |
| `SUPABASE_SERVICE_KEY` | Supabase | Service role API key | ✅ Yes |
| `OPENAI_API_KEY` | OpenAI | LLM for scoring & qualification | ⚠️ Or alternative |
| `GROQ_API_KEY` | Groq | LLM fallback (free tier) | ⚠️ Or alternative |
| `GEMINI_API_KEY` | Google | LLM fallback (free tier) | ⚠️ Or alternative |
| `MISTRAL_API_KEY` | Mistral | LLM fallback (free tier) | ⚠️ Or alternative |
| `RESEND_API_KEY` | Resend | Email sending | ✅ Yes |
| `GMAIL_FROM_EMAIL` | Gmail | Email fallback | ⚠️ Or Resend |
| `GMAIL_APP_PASSWORD` | Gmail | Email fallback auth | ⚠️ Or Resend |
| `GOVCHAIN_URL` | AuthiChain | Portal link in emails | ✅ Yes |

### Database Indexes (Auto-Created by Migration)

| Index | Table | Purpose |
|-------|-------|---------|
| `gov_opportunities_status_fit_score_idx` | gov_opportunities | Fast queries of high-fit leads |
| `leads_source_status_contacted_idx` | leads | Fast uncontacted lead lookups |
| `leads_email_idx` | leads | Suppression list checks |

---

## Validation Checklist

- [ ] Scripts created (3 new, 1 updated)
- [ ] Migration file created
- [ ] Database migration applied
- [ ] Environment variables set in `.env` and GitHub Secrets
- [ ] Email service configured (Resend or Gmail)
- [ ] Suppression list configured
- [ ] GitHub Actions workflow updated
- [ ] DRY_RUN tests pass locally
- [ ] Real data test passes locally
- [ ] GitHub Actions test passes (manual dispatch)
- [ ] Monitoring queries verified
- [ ] Alert thresholds configured

---

## Rollback Plan

If issues arise:

```bash
# Revert script changes (git)
git revert <commit>

# Revert database migration (Supabase)
supabase db reset --linked

# Or manually drop indexes/columns:
DROP INDEX IF EXISTS gov_opportunities_status_fit_score_idx;
ALTER TABLE leads DROP COLUMN IF EXISTS threadId;
```

---

## Next Steps

1. **Immediate:** Apply migration & test locally
2. **This week:** Deploy to GitHub Actions
3. **Ongoing:** Monitor lead qualification rate & email engagement
4. **Future:** Add manual review UI for 60-69 leads, LinkedIn outreach, CRM sync
