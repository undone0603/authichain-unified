# Government Engine Lead Scoring & Qualification Pipeline

This document describes the lead scoring and qualification system for the AuthiChain government contracting engine.

## Overview

The pipeline converts 258 SAM.gov opportunities into qualified leads by:
1. **Scoring** opportunities (fit_score 0-100)
2. **Filtering** to qualified leads (fit_score ≥ 70)
3. **Qualifying** into the leads table with detailed scoring breakdown
4. **Emailing** proposals to qualified leads only

This prevents email quota waste and protects reputation by avoiding low-fit agencies.

## Architecture

```
SAM.gov → ingest-sam.ts → gov_opportunities (status='new')
            ↓
      score-opportunities.ts
            ↓
    ┌─────────────────────────────────┐
    │ gov_opportunities (fit_score)    │
    ├─────────────────────────────────┤
    │ fit_score < 60  → status='skipped'
    │ fit_score 60-69 → status='scored', recommended_action='qualify'
    │ fit_score ≥ 70  → status='scored', recommended_action='pursue'
    └─────────────────────────────────┘
            ↓
      qualify-leads.ts
            ↓
    ┌─────────────────────────────────┐
    │ leads (gov_engine source)        │
    │ status='qualified'               │
    │ metadata.lead_score_detail       │
    └─────────────────────────────────┘
            ↓
    generate-proposals.ts
            ↓
    ┌─────────────────────────────────┐
    │ gov_proposals (draft generated)  │
    └─────────────────────────────────┘
            ↓
      email-proposals.ts
            ↓
    Send to qualified leads only
    (no low-fit agencies contacted)
```

## Scripts

### 1. score-opportunities.ts (Updated)

**Purpose:** Score SAM.gov opportunities and categorize by fit.

**Changes:**
- Fit_score thresholds:
  - `≥ 70`: recommended_action = 'pursue', status = 'scored'
  - `60-69`: recommended_action = 'qualify', status = 'scored' (manual review queue)
  - `< 60`: recommended_action = 'skip', status = 'skipped'
- Query filters: `status='new'`
- Output columns:
  - fit_score (0-100)
  - ai_reasoning (2-sentence justification)
  - key_requirements (JSON array)
  - recommended_action ('pursue' | 'qualify' | 'skip')
  - status ('scored' | 'skipped')

**Environment Variables:**
```bash
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...           # (or GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY)
GOVCHAIN_URL=https://govchain.us
DRY_RUN=true                    # (optional, preview changes)
```

**Run:**
```bash
pnpm tsx scripts/score-opportunities.ts
```

**Output:**
```
  [82/100] GSA IEVV Vehicle Authentication → pursue
  [65/100] DHS Supply Chain Verification → qualify
  [48/100] USDA License Audit System → skip
✅ Scored 50/50 opportunities (0 failed)
```

---

### 2. qualify-leads.ts (New)

**Purpose:** Convert high-fit opportunities (≥70) into qualified leads with detailed scoring.

**Query Filters:**
- `status='scored'`
- `fit_score >= 70`

**Generates:**
- `lead_score_detail` JSON (4 dimensions × 0-100):
  - `blockchain_fit`: Blockchain authentication/provenance alignment
  - `agency_sector_match`: Agency mission & sector fit
  - `budget_alignment`: Contract value readiness
  - `timeline_fit`: Execution feasibility
- Creates/updates `leads` table entries:
  - source = 'gov_engine'
  - status = 'qualified'
  - metadata = { opportunity_id, fit_score, lead_score_detail, ... }
  - company = opportunity.agency
  - leadScore = opportunity.fit_score

**Updates:**
- `gov_opportunities.status = 'qualified'`
- `gov_opportunities.qualified_at = now()`

**Environment Variables:**
```bash
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...           # (or GROQ_API_KEY, etc.)
DRY_RUN=true                    # (optional)
```

**Run:**
```bash
pnpm tsx scripts/qualify-leads.ts
```

**Output:**
```
  ✅ Qualified: GSA IEVV Vehicle Authentication (82/100)
  ✅ Qualified: DHS Biometric Authorization (78/100)
✅ Qualified 15/20 leads (0 failed)
```

**Leads Table Schema (Existing):**
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  email VARCHAR(320),                    -- gov@agency.gov (derived from opportunity)
  name VARCHAR(256),                     -- Agency name
  company VARCHAR(256),                  -- Agency name (opp.agency)
  source VARCHAR(128),                   -- 'gov_engine'
  score INTEGER DEFAULT 0,               -- Overall fit (0-100)
  leadScore INTEGER DEFAULT 0,           -- fit_score from opportunity
  status VARCHAR(50) DEFAULT 'new',      -- 'qualified', 'contacted', 'responded'
  industry VARCHAR(128),                 -- NAICS code or 'Government'
  lastContactedAt TIMESTAMPTZ,           -- When proposal email was sent
  metadata JSON,                         -- Stores lead_score_detail, opportunity_id, etc.
  createdAt TIMESTAMPTZ DEFAULT now(),
  updatedAt TIMESTAMPTZ DEFAULT now()
);
```

**Metadata Structure (JSON):**
```json
{
  "opportunity_id": "SAM-12345678",
  "fit_score": 82,
  "key_requirements": ["Blockchain auth", "NSA compliance", ...],
  "ai_reasoning": "Strong match on supply chain provenance...",
  "lead_score_detail": {
    "blockchain_fit": {
      "score": 95,
      "rationale": "Opportunity explicitly mentions zero-trust authentication..."
    },
    "agency_sector_match": {
      "score": 88,
      "rationale": "GSA is core federal IT procurement arm..."
    },
    "budget_alignment": {
      "score": 72,
      "rationale": "Contract value $500K-$2M aligns with AuthiChain capacity..."
    },
    "timeline_fit": {
      "score": 78,
      "rationale": "90-day deadline allows full capability statement..."
    }
  },
  "govchain_url": "https://govchain.us/opportunities/SAM-12345678",
  "sam_url": "https://sam.gov/opp/...",
  "deadline": "2026-07-25"
}
```

---

### 3. email-proposals.ts (New)

**Purpose:** Send proposal emails to qualified leads with fit score breakdown.

**Query Filters:**
- `leads.source = 'gov_engine'`
- `leads.status = 'qualified'`
- `leads.lastContactedAt IS NULL` (not yet contacted)

**Email Template:**
```
Subject: AuthiChain Proposal: [Opportunity Title]

Dear [Agency],

AuthiChain is excited to present our blockchain-powered authentication 
platform for your procurement need:

Title: [Opportunity Title]
Deadline: [Deadline]
GovChain Portal: [govchain_url]

--- PROPOSAL OVERVIEW ---
[AI-generated 400-word capability statement from gov_proposals]

--- QUALIFICATION ANALYSIS ---
Your opportunity aligns across these dimensions:
Blockchain authentication: 95/100
Agency sector fit: 88/100
Budget alignment: 72/100
Timeline feasibility: 78/100

[Full proposal from gov_proposals.proposal_draft]

--- NEXT STEPS ---
1. Review full capability at [govchain_url]
2. Contact: govchain@authichain.us
3. Schedule technical briefing

Best regards,
AuthiChain Government Affairs Team
```

**Updates:**
- `leads.status = 'contacted'`
- `leads.lastContactedAt = now()`
- If reply received: `leads.emailReplied = true`, `leads.respondedAt = now()`

**Environment Variables:**
```bash
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
RESEND_API_KEY=re_...           # (or GMAIL_FROM_EMAIL + GMAIL_APP_PASSWORD)
GOVCHAIN_URL=https://govchain.us
DRY_RUN=true                    # (optional)
```

**Run:**
```bash
pnpm tsx scripts/email-proposals.ts
```

**Output:**
```
  ✉️  Sent proposal to General Services Administration (procurement@gsa.gov)
  ✉️  Sent proposal to Department of Homeland Security (procurement@dhs.gov)
✅ Sent 8/10 proposals (0 failed, 2 skipped)
```

---

## Deployment: GitHub Actions

Add to `.github/workflows/gov-engine.yml`:

```yaml
name: Government Engine Pipeline

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  gov-engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Ingest SAM.gov Opportunities
        run: pnpm tsx scripts/ingest-sam.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Score Opportunities (fit_score)
        run: pnpm tsx scripts/score-opportunities.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOVCHAIN_URL: ${{ secrets.GOVCHAIN_URL }}

      - name: Qualify High-Fit Leads (fit_score ≥ 70)
        run: pnpm tsx scripts/qualify-leads.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Generate Proposal Drafts (65+ fit_score)
        run: pnpm tsx scripts/generate-proposals.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOVCHAIN_URL: ${{ secrets.GOVCHAIN_URL }}

      - name: Send Proposal Emails to Qualified Leads
        run: pnpm tsx scripts/email-proposals.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          GOVCHAIN_URL: ${{ secrets.GOVCHAIN_URL }}
```

---

## Data Flow Example

**Input:** SAM.gov opportunity
```json
{
  "notice_id": "SAM-2026-06-25-001",
  "title": "Government Vehicle Authentication System",
  "agency": "General Services Administration",
  "description": "Seeking blockchain-based vehicle authentication...",
  "deadline": "2026-07-25"
}
```

**After score-opportunities.ts:**
```json
{
  "fit_score": 82,
  "ai_reasoning": "Strong blockchain/supply chain fit; GSA is core federal IT buyer.",
  "recommended_action": "pursue",
  "status": "scored",
  "key_requirements": ["Zero-trust auth", "ERC-721 NFT", "NSA compliance"]
}
```

**After qualify-leads.ts:**
```json
{
  "leads table":
  {
    "email": "procurement@gsa.gov",
    "company": "General Services Administration",
    "source": "gov_engine",
    "leadScore": 82,
    "status": "qualified",
    "metadata": {
      "opportunity_id": "SAM-2026-06-25-001",
      "lead_score_detail": {
        "blockchain_fit": { "score": 95, "rationale": "..." },
        "agency_sector_match": { "score": 88, "rationale": "..." },
        "budget_alignment": { "score": 72, "rationale": "..." },
        "timeline_fit": { "score": 78, "rationale": "..." }
      }
    }
  }
}
```

**After email-proposals.ts:**
```
Email sent to procurement@gsa.gov with:
- AI-generated 400-word capability statement
- Fit scores: Blockchain auth 95/100, Agency sector 88/100, Budget 72/100, Timeline 78/100
- Call to action (govchain@authichain.us)

leads.lastContactedAt = 2026-06-25T10:30:00Z
leads.status = 'contacted'
```

---

## Database Queries

### Find all qualified leads awaiting outreach:
```sql
SELECT id, company, email, metadata->>'lead_score_detail' as scores
  FROM leads
 WHERE source = 'gov_engine'
   AND status = 'qualified'
   AND lastContactedAt IS NULL
 ORDER BY leadScore DESC;
```

### Find opportunities in manual review queue (60-69 fit_score):
```sql
SELECT notice_id, title, fit_score, recommended_action
  FROM gov_opportunities
 WHERE status = 'scored'
   AND recommended_action = 'qualify'
   AND fit_score BETWEEN 60 AND 69
 ORDER BY fit_score DESC;
```

### Engagement metrics (replies to proposals):
```sql
SELECT 
  company,
  COUNT(*) as total_leads,
  SUM(CASE WHEN emailReplied THEN 1 ELSE 0 END) as replies,
  ROUND(100.0 * SUM(CASE WHEN emailReplied THEN 1 ELSE 0 END) / COUNT(*), 1) as reply_rate
 FROM leads
 WHERE source = 'gov_engine'
 GROUP BY company
 ORDER BY replies DESC;
```

---

## Testing

### Dry Run (no database writes):
```bash
DRY_RUN=true pnpm tsx scripts/qualify-leads.ts
DRY_RUN=true pnpm tsx scripts/email-proposals.ts
```

### Manual Lead Creation (test email):
```sql
INSERT INTO leads (
  email, name, company, source, leadScore, status, metadata, createdAt, updatedAt
) VALUES (
  'test@example.com',
  'Test Agency',
  'Test Agency',
  'gov_engine',
  75,
  'qualified',
  '{"opportunity_id": "TEST-001", "lead_score_detail": {...}}',
  now(),
  now()
);
```

Then:
```bash
pnpm tsx scripts/email-proposals.ts
```

---

## Monitoring & Alerts

### Key Metrics:
- **Opportunities ingested:** gov_opportunities count by status
- **Fit score distribution:** P50, P75, P90 of fit_score
- **Qualified lead rate:** (fit_score ≥ 70) / total
- **Email open rate:** leads.emailOpened / leads.lastContactedAt IS NOT NULL
- **Reply rate:** leads.emailReplied / lastContactedAt IS NOT NULL
- **Email quota:** 80% alert threshold

### Suppress Emails To:
Edit `SUPPRESSION_LIST` in `.env`:
```
SUPPRESSION_LIST=test@example.com,internal@authichain.us,spam@example.com
```

---

## FAQ

**Q: Why separate qualify-leads.ts from score-opportunities.ts?**
A: Scoring is fast (LLM inference), but qualification generates detailed analysis (multiple LLM calls). Separation allows scoring to run nightly while qualification can be triggered on-demand or less frequently.

**Q: Can I manually review the 60-69 borderline leads?**
A: Yes. These have `recommended_action='qualify'` in gov_opportunities. Query them, review, then manually move high-confidence ones to leads table or update status='qualified' in gov_opportunities.

**Q: What if I want to change the fit_score threshold?**
A: Edit the `FIT_THRESHOLD` constants in scripts:
- score-opportunities.ts: `FIT_THRESHOLD_HIGH=70`, `FIT_THRESHOLD_BORDERLINE=60`
- qualify-leads.ts: `FIT_THRESHOLD=70`

**Q: Does email engagement get tracked?**
A: Yes, via:
- `leads.emailOpened` (webhook from Resend)
- `leads.emailClicked` (Resend link tracking)
- `leads.emailReplied` (Gmail thread reply detection)
- `leads.respondedAt` (timestamp of first reply)

**Q: Can I recontact a lead?**
A: Update `leads.lastContactedAt = NULL` and `leads.status = 'qualified'` to re-queue them.
