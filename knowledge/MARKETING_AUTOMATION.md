# Marketing & Lead Automation Protocol
**Philosophy:** 95% hands-free operations using the "Free-Tier Stack" (Mailchimp + Make.com + Airtable).

## The Automation Stack
| Tool | Role | Configuration |
| :--- | :--- | :--- |
| **Mailchimp** | Email Nurture | 14-email automated sequence |
| **Make.com** | Orchestrator | Webhook → Database → Mailchimp → Slack |
| **Airtable** | Source of Truth | CRM, Lead Scoring, and Task Tracking |
| **Stripe** | Conversion | Checkout session webhooks trigger fulfillment |

## Lead Capture Flow (Blueprint #1)
1. **User Submits Form** on `authichain.com` or `strainchain.io`.
2. **Make.com Webhook** triggers instantly.
3. **Airtable Record** created in `Manufacturers` table.
4. **Mailchimp Subscriber** added with `Industry` and `Source` tags.
5. **Slack Alert** sent to team: *"New High-Value Lead: {{company}}"*.
6. **14-Email Sequence** starts automatically in Mailchimp.

## Key Scenarios (Make.com Blueprints)
- **Scenario 1:** Lead Capture (Webhook → Airtable → Mailchimp → Slack)
- **Scenario 2:** Payment Tracking (Stripe → Google Sheets → Airtable Deal Update)
- **Scenario 3:** Daily Ops Digest (Scheduled search of Airtable → Email report)
- **Scenario 4:** High-Value Alert (Condition: Deal > $10K → Instant Notification)

## Free Plan Guardrails
- **Make.com:** Limit to 1,000 operations/month. Use "Part 1" (Subscriber Add) only, let Mailchimp handle the 14 sends (0 ops).
- **Airtable:** Use internal Airtable Automations for logic (Unlimited/Free).
- **Zapier:** Deprecated for this project due to webhook pricing.
