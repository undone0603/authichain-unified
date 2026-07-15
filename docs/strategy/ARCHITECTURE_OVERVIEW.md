# Email Reply Capture & Auto-Nurture System — Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    OUTBOUND: Sales sends proposal               │
│  From: proposals@authichain.com → To: prospect@company.com      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              INBOUND: Prospect replies to same address           │
│         From: prospect@company.com → To: proposals@authichain.com│
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Resend Email Service                         │
│        Receives inbound email, routes to webhook                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         POST /api/webhooks/resend-inbound                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Parse email (from, subject, body, messageId)         │  │
│  │ 2. Filter auto-replies/bounces                           │  │
│  │ 3. Check for duplicates (idempotency)                    │  │
│  │ 4. Classify sentiment using GPT-4                        │  │
│  │ 5. Match to original proposal (exact/fuzzy)              │  │
│  │ 6. Insert into inbound_replies table                     │  │
│  │ 7. Create reply_sequences entry                          │  │
│  │ 8. Update leads table                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
         ┌─────────────┐ ┌────────────┐ ┌──────────┐
         │   Positive  │ │ Objection  │ │ Negative │
         │   Sentiment │ │ Sentiment  │ │ Sentiment│
         └──────┬──────┘ └────────┬───┘ └────┬─────┘
                │                 │           │
                ▼                 ▼           ▼
         ┌─────────────────────────────────────────┐
         │     Create reply_sequences entry        │
         │     Set nextScheduledAt = NOW + delay   │
         │     Delay by type:                      │
         │     - Positive: 2 hours                 │
         │     - Objection: 3-6 hours (by type)    │
         │     - Negative: none (manual review)    │
         └──────────────┬──────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │   Every 2 hours:                     │
         │   GET /api/cron/nurture-replies      │
         │   ┌──────────────────────────────┐  │
         │   │ 1. Find pending sequences    │  │
         │   │ 2. Generate email (template) │  │
         │   │ 3. Send via sendEmail()      │  │
         │   │ 4. Update status = 'sent'    │  │
         │   │ 5. Log to audit trail        │  │
         │   └──────────────────────────────┘  │
         └──────────────┬─────────────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │   Prospect receives    │
            │   follow-up email      │
            │                        │
            │   + Calendly link      │
            │   + ROI calculator     │
            │   + Next steps         │
            └────────────┬───────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
     ┌─────────────────┐  ┌──────────────────┐
     │ Prospect clicks │  │ No action = wait │
     │ link            │  │ 7 days then send │
     │ (tracked in DB) │  │ reminder email   │
     └────────┬────────┘  └────────┬─────────┘
              │                    │
              ▼                    ▼
     ┌─────────────────────────────────────┐
     │ Sales team views reply on dashboard │
     │ /dashboard/inbound-replies          │
     │                                     │
     │ Can:                                │
     │ - View sentiment + objection type   │
     │ - Mark as Contacted/Deal Won        │
     │ - Manually override sentiment       │
     │ - Export unmatched for review       │
     └─────────────────────────────────────┘
```

---

## Data Flow

### 1. Email Capture Pipeline

```
Resend webhook POST
    ↓
Parse fields (from, subject, body, messageId)
    ↓
Validate & filter (not auto-reply/bounce)
    ↓
Check duplicate (SELECT WHERE messageId)
    ↓
Classify sentiment (GPT-4 API call)
    ↓
Match to proposal (exact email → fuzzy subject → no match)
    ↓
INSERT inbound_replies {
  lead_email, subject, sentiment, objectionType,
  confidence, proposalMatchId, matchConfidence,
  status='new', metadata
}
    ↓
INSERT reply_sequences {
  lead_id, reply_id, templateType,
  status='pending', nextScheduledAt
}
    ↓
UPDATE leads {
  emailReplied=true, sentiment, lastReplyAt,
  objectionType, repliesReceived++
}
    ↓
Return 201 response
```

### 2. Nurture Execution Pipeline

```
Cron: GET /api/cron/nurture-replies (every 2 hours)
    ↓
SELECT reply_sequences WHERE status='pending'
  AND nextScheduledAt <= NOW
    ↓
For each pending sequence:
  ├─ SELECT inbound_replies JOIN leads
  ├─ selectTemplate(sentiment, objectionType)
  ├─ generateEmailTemplate({leadName, leadCompany, objectionDetails})
  ├─ sendEmail({to, from, subject, html, text})
  └─ UPDATE reply_sequences {
      status='sent',
      sentAt=NOW,
      emailSubject, emailBody, metadata
    }
    ↓
Log results (count, successes, failures)
    ↓
Return 200 response
```

### 3. Dashboard Query Pipeline

```
GET /api/dashboard/replies?sentiment=positive&status=new
    ↓
Parse query params (sentiment, status, page, limit)
    ↓
Build WHERE clause (conditions array)
    ↓
SELECT inbound_replies WHERE ...
  ORDER BY created_at DESC
  LIMIT 20 OFFSET 0
    ↓
Format response {success, replies, page, limit}
    ↓
Return 200 with reply data
```

---

## Database Schema

### inbound_replies table

| Column | Type | Index | Purpose |
|--------|------|-------|---------|
| id | uuid PK | - | Unique reply ID |
| lead_id | int FK | ✓ lead | Links to leads table |
| lead_email | varchar | ✓ email | Sender email address |
| sender_name | varchar | - | Extracted from From header |
| subject | varchar | - | Email subject line |
| body_plaintext | text | - | Plain text version of email |
| body_html | text | - | HTML version of email |
| message_id | varchar | U | Resend message ID (deduplication) |
| sentiment | varchar | ✓ sentiment | positive\|neutral\|negative\|objection |
| objection_type | varchar | - | budget\|timeline\|competitor\|decision_maker\|other |
| objection_details | text | - | Free-form objection description |
| confidence | real | - | 0.0-1.0 from AI classifier |
| proposal_match_id | varchar | - | UUID of matched proposal |
| match_confidence | real | - | 0.0-1.0 confidence in match |
| status | varchar | ✓ status | new\|contacted\|deal_won\|disqualified\|nurture_paused |
| manual_override | boolean | - | Sales team corrected sentiment |
| manual_sentiment | varchar | - | Human-provided sentiment |
| overridden_by | int FK | - | User ID who overrode |
| overridden_at | timestamp | - | When override occurred |
| metadata | jsonb | - | Headers, thread info, match reason |
| created_at | timestamp | - | When reply received |
| updated_at | timestamp | - | Last modification |

### reply_sequences table

| Column | Type | Index | Purpose |
|--------|------|-------|---------|
| id | uuid PK | - | Unique sequence ID |
| lead_id | int FK | ✓ lead | Links to leads |
| reply_id | uuid FK | ✓ reply | Links to inbound_replies |
| template_type | varchar | - | objection_budget\|positive_followup\|reminder |
| sequence_number | int | - | 1, 2, 3... in multi-touch sequence |
| status | varchar | ✓ status | pending\|sent\|clicked\|bounced\|paused |
| sent_at | timestamp | - | When email sent |
| clicked_at | timestamp | - | If link clicked (future) |
| next_scheduled_at | timestamp | ✓ scheduled | When to send (cron uses this) |
| email_subject | varchar | - | Generated subject line |
| email_body | text | - | Generated email body |
| metadata | jsonb | - | Link tracking, template params |
| created_at | timestamp | - | When sequence created |
| updated_at | timestamp | - | Last modification |

### leads table extensions

| Column | Type | Purpose |
|--------|------|---------|
| sentiment | varchar | Latest sentiment from any reply |
| last_reply_at | timestamp | When last reply received |
| objection_type | varchar | Latest objection type |
| nurture_paused | boolean | Sales team can pause sequences |
| proposals_sent | int | Count of proposals sent to lead |
| replies_received | int | Count of replies from lead |

---

## Templates & Delays

### Sentiment → Template Mapping

| Sentiment | Objection Type | Template | Delay | Strategy |
|-----------|----------------|----------|-------|----------|
| positive | null | positive_followup | 2 hrs | Send calendar link |
| objection | budget | objection_budget | 4 hrs | Pilot pricing highlight |
| objection | timeline | objection_timeline | 6 hrs | Phased approach |
| objection | competitor | objection_competitor | 3 hrs | Differentiation doc |
| objection | decision_maker | objection_decision_maker | 5 hrs | Escalation path |
| objection | other | objection_generic | 4 hrs | Generic objection response |
| neutral | null | (no auto-nurture) | - | Manual review |
| negative | null | (no auto-nurture) | - | Manual review |

---

## API Endpoints

### 1. Inbound Webhook
**Path**: `POST /api/webhooks/resend-inbound`

**Request**:
```json
{
  "from": "prospect@company.com",
  "subject": "RE: Proposal: Blockchain Auth for Acme",
  "text": "Thanks! Very interested.",
  "html": "<p>Thanks! Very interested.</p>",
  "messageId": "c92a7bac-7fca-47ba-957d-c5cd9d1f8b5d",
  "inReplyTo": null,
  "headers": {...}
}
```

**Response**:
```json
{
  "success": true,
  "replyId": "uuid",
  "sentiment": "positive",
  "matchConfidence": 1.0,
  "leadId": 42
}
```

### 2. Cron Job
**Path**: `GET /api/cron/nurture-replies`

**Headers**:
```
Authorization: Bearer ${CRON_SECRET}
```

**Response**:
```json
{
  "success": true,
  "processed": 15,
  "message": "Processed 15 reply nurture actions"
}
```

### 3. Dashboard API - Get Replies
**Path**: `GET /api/dashboard/replies?sentiment=positive&status=new&page=1&limit=20`

**Response**:
```json
{
  "success": true,
  "replies": [
    {
      "id": "uuid",
      "leadEmail": "prospect@company.com",
      "subject": "RE: Proposal...",
      "sentiment": "positive",
      "objectionType": null,
      "matchConfidence": 1.0,
      "status": "new",
      "createdAt": "2026-06-25T15:30:00Z"
    }
  ],
  "page": 1,
  "limit": 20
}
```

### 4. Dashboard API - Update Reply
**Path**: `PATCH /api/dashboard/replies`

**Request**:
```json
{
  "id": "uuid",
  "status": "contacted",
  "manualSentiment": "positive"
}
```

**Response**:
```json
{
  "success": true,
  "reply": {...}
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All files created/modified
- [ ] Database migrations applied (`supabase db push`)
- [ ] Schema verified in Supabase console
- [ ] No TypeScript errors (`pnpm check`)

### Configuration
- [ ] Resend domain verified
- [ ] Inbound route created (`proposals@authichain.com`)
- [ ] Webhook secret copied from Resend
- [ ] Environment variables set:
  - [ ] `RESEND_WEBHOOK_SECRET`
  - [ ] `NURTURE_EMAIL_FROM`
  - [ ] `CALENDLY_URL`
  - [ ] `CRON_SECRET`
- [ ] Cron job configured in `vercel.json`

### Testing
- [ ] Webhook accepts POST request
- [ ] Email parsing works (test with sample)
- [ ] Sentiment classification accurate
- [ ] Proposal matching successful
- [ ] Nurture sequences created
- [ ] Cron job runs (test manually)
- [ ] Dashboard loads and shows replies
- [ ] Status/sentiment updates work

### Production
- [ ] All tests passing
- [ ] Performance acceptable (< 2sec per reply)
- [ ] Database indexes in place
- [ ] Error logging configured
- [ ] Sales team access verified
- [ ] Deploy to production

---

## Performance & Scaling

### Single Reply Processing
- Parse: < 100ms
- Sentiment classification: 1-2 seconds (GPT-4 API)
- Proposal matching: < 50ms
- Database insert: < 50ms
- **Total: 2-3 seconds per reply**

### Cron Job Batch (10-20 sequences)
- Query pending sequences: < 100ms
- Generate emails (10x): 100-200ms total
- Send emails (10x via API): 2-3 seconds
- Update database (10x): 100-200ms
- **Total: 3-4 seconds per batch**

### Dashboard Query
- SELECT with filters: < 100ms
- Format response: < 50ms
- **Total: < 200ms latency**

### Storage
- 258 proposals → 77 replies → 77 inbound_replies rows
- 77 replies × 2-3 touch sequences → 150-230 reply_sequences rows
- ~500KB total storage (small, not a constraint)

---

## Monitoring & Observability

### Key Metrics

```sql
-- Hourly reply volume
SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*)
FROM inbound_replies
GROUP BY hour
ORDER BY hour DESC;

-- Sentiment distribution
SELECT sentiment, COUNT(*) as count
FROM inbound_replies
GROUP BY sentiment;

-- Objection types
SELECT objection_type, COUNT(*) as count
FROM inbound_replies
WHERE sentiment = 'objection'
GROUP BY objection_type;

-- Nurture effectiveness
SELECT COUNT(*) as deals_won
FROM inbound_replies
WHERE status = 'deal_won';

-- Match accuracy
SELECT COUNT(*) FILTER (WHERE match_confidence > 0.8) as high_confidence,
       COUNT(*) FILTER (WHERE match_confidence <= 0.8) as needs_review
FROM inbound_replies;

-- Pending nurture
SELECT COUNT(*) as pending
FROM reply_sequences
WHERE status = 'pending' AND next_scheduled_at <= NOW();
```

### Error Alerts

Set up monitoring for:
1. Webhook response time > 5 seconds
2. Sentiment classification failures
3. Cron job failures (HTTP 5xx)
4. Email delivery failures (bounced status)
5. Database query timeouts

---

## Security Considerations

1. **Webhook Authentication**: Verify `RESEND_WEBHOOK_SECRET` header (implement if needed)
2. **Cron Authentication**: Require `CRON_SECRET` bearer token
3. **Email Parsing**: Sanitize email body before storing (prevent injection)
4. **Database Access**: RLS policies on inbound_replies (future)
5. **Rate Limiting**: No rate limit on webhook (Resend handles it), no per-user limits on dashboard
6. **GDPR Compliance**: Auto-purge old emails (add monthly job)

---

## Future Enhancements

1. **Email Link Tracking**: Track clicks on Calendly/ROI links
2. **Multi-Touch Sequences**: Send 2-3 follow-ups if no engagement
3. **Slack Integration**: Notify #sales-alerts on positive replies
4. **A/B Testing**: Test different templates, track conversion
5. **Competitor Intelligence**: Extract competitor mentions for sales intel
6. **Auto-Assignment**: Route positive replies to specific sales rep
7. **Stripe Integration**: Create checkout sessions for interested prospects
8. **Calendar Booking Sync**: Sync Calendly bookings back to lead status

---

*Architecture finalized June 25, 2026*
*Ready for production deployment*
