# Lead Scoring Quick Start

## The One-Minute Overview

**Problem:** 258 SAM.gov proposals → waste quota emailing low-fit agencies (fit_score 0-60)

**Solution:** Filter at fit_score ≥ 70, generate detailed lead scores, only email qualified prospects

**Result:** ~70% reduction in unwanted outreach + detailed scoring breakdown in emails

---

## Files You Need to Know About

| File | Status | What It Does |
|------|--------|-------------|
| `scripts/score-opportunities.ts` | ✏️ UPDATED | Scores opportunities, gates at 70/60 thresholds |
| `scripts/qualify-leads.ts` | ✨ NEW | Converts scores into qualified leads with 4-dim breakdown |
| `drizzle/migrations/015_lead_scoring_pipeline.sql` | ✨ NEW | Adds DB columns & indexes |
| `docs/gov-engine-lead-pipeline.md` | 📖 NEW | Full architecture guide |
| `docs/INTEGRATION_CHECKLIST.md` | 📖 NEW | Step-by-step deploy |

---

## Deploy in 5 Steps

### 1. Apply Migration
```bash
# Backup first, then:
supabase migration up
# Or manually run: drizzle/migrations/015_lead_scoring_pipeline.sql
```

### 2. Test Locally (Dry Run)
```bash
DRY_RUN=true pnpm tsx scripts/score-opportunities.ts
DRY_RUN=true pnpm tsx scripts/qualify-leads.ts
```

### 3. Add to GitHub Actions
```yaml
- name: Qualify High-Fit Leads
  run: pnpm tsx scripts/qualify-leads.ts
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 4. Commit & Push
```bash
git add scripts/score-opportunities.ts scripts/qualify-leads.ts \
        drizzle/migrations/015_lead_scoring_pipeline.sql
git commit -m "feat: lead scoring & qualification pipeline"
git push
```

### 5. Monitor
```sql
SELECT COUNT(*) as qualified_leads 
FROM leads 
WHERE source='gov_engine' AND status='qualified';
```

---

## Key Thresholds

```
fit_score ≥ 70     → status='scored', action='pursue'  → Send email
fit_score 60-69    → status='scored', action='qualify' → Manual review
fit_score < 60     → status='skipped'                  → No contact
```

---

## What Gets Created in `leads` Table

```json
{
  "email": "procurement@agency.gov",
  "company": "General Services Administration",
  "source": "gov_engine",
  "leadScore": 82,
  "status": "qualified",
  "metadata": {
    "opportunity_id": "SAM-12345",
    "lead_score_detail": {
      "blockchain_fit": { "score": 95, "rationale": "..." },
      "agency_sector_match": { "score": 88, "rationale": "..." },
      "budget_alignment": { "score": 72, "rationale": "..." },
      "timeline_fit": { "score": 78, "rationale": "..." }
    }
  }
}
```

---

## SQL Queries to Know

**Count qualified leads:**
```sql
SELECT COUNT(*) FROM leads 
WHERE source='gov_engine' AND status='qualified';
```

**Find borderline leads (manual review):**
```sql
SELECT title, fit_score FROM gov_opportunities 
WHERE recommended_action='qualify' 
ORDER BY fit_score DESC;
```

**Email engagement:**
```sql
SELECT company, 
  COUNT(*) as sent,
  SUM(CASE WHEN emailOpened THEN 1 ELSE 0 END) as opened
FROM leads
WHERE source='gov_engine' AND lastContactedAt IS NOT NULL
GROUP BY company;
```

---

## Troubleshooting

**"No qualified leads"** → Check: `SELECT COUNT(*) FROM gov_opportunities WHERE fit_score >= 70;`

**"No proposals generated"** → Run: `pnpm tsx scripts/generate-proposals.ts` first

**"Email not sending"** → Check RESEND_API_KEY, see `docs/email-proposals-integration.md`

---

## Next: Integrate Email Sending

The existing `scripts/email-proposals.ts` can query from `leads` table.

Options:
- **Option A (Easy):** Keep using gov_proposals table as-is
- **Option B (Recommended):** Migrate to leads table + add fit_score breakdown

See: `docs/email-proposals-integration.md`

---

## Full Documentation

- **Architecture & Data Flow:** `docs/gov-engine-lead-pipeline.md`
- **Deployment Steps:** `docs/INTEGRATION_CHECKLIST.md`
- **Email Integration:** `docs/email-proposals-integration.md`
- **Summary:** `LEAD_SCORING_SUMMARY.md`

---

## Environment Variables Needed

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
GOVCHAIN_URL=https://govchain.us
# + optionally: RESEND_API_KEY, DRY_RUN=true
```

---

**Status:** Ready to deploy. Start with Step 1 (migration).
