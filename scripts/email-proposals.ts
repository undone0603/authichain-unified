// scripts/email-proposals.ts
// Email high-fit government proposals to agency contacts.
// Queries gov_proposals with email_status='unsent' and fit_score >= 70,
// sends personalized HTML emails via Resend, updates delivery status.

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const isDryRun = process.env.DRY_RUN === 'true';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const GOVCHAIN = process.env.GOVCHAIN_URL ?? 'https://govchain.us';
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'proposals@authichain.com';
const CALENDAR_LINK = process.env.CALENDLY_LINK ?? 'https://calendly.com/authichain/discovery';
const SALES_EMAIL = process.env.SALES_EMAIL ?? 'sales@authichain.com';

// Gracefully skip if Resend isn't configured.
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not configured — skipping email delivery.');
  process.exit(0);
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface Proposal {
  notice_id: string;
  title: string;
  agency: string;
  fit_score: number;
  proposal_draft: string;
  contact_email?: string;
  contact_person?: string;
  govchain_url: string;
  deadline: string;
}

/**
 * Append funnel-attribution params to a CTA URL so the FunnelTracker on the
 * landing page can tie this click back to the originating proposal/email.
 * Safely respects any query string the base URL already carries.
 */
function withAttribution(url: string, prospectId: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}prospect_id=${encodeURIComponent(prospectId)}&utm_source=email&utm_medium=gov_proposal&utm_campaign=govchain_outreach`;
}

function generateEmailHtml(proposal: Proposal): string {
  const fitReason = generateFitReason(proposal.fit_score);
  const opportunityId = proposal.notice_id;
  const detailsUrl = withAttribution(`${GOVCHAIN}/${opportunityId}`, opportunityId);
  const calendarUrl = withAttribution(CALENDAR_LINK, opportunityId);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GovChain Proposal: ${proposal.agency}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 20px;
    }
    .greeting {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .opportunity {
      background-color: #f3f4f6;
      border-left: 4px solid #667eea;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .opportunity h3 {
      margin: 0 0 8px 0;
      color: #1f2937;
      font-size: 16px;
    }
    .opportunity p {
      margin: 4px 0;
      font-size: 14px;
      color: #6b7280;
    }
    .fit-score {
      display: inline-block;
      background-color: #dbeafe;
      color: #0c4a6e;
      padding: 8px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
      margin: 12px 0;
    }
    .fit-reason {
      font-size: 14px;
      color: #4b5563;
      margin-top: 12px;
      line-height: 1.5;
    }
    .cta-section {
      margin: 30px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      margin: 8px 4px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-primary {
      background-color: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background-color: #5568d3;
    }
    .btn-secondary {
      background-color: #e5e7eb;
      color: #1f2937;
    }
    .btn-secondary:hover {
      background-color: #d1d5db;
    }
    .proposal-preview {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 16px;
      border-radius: 4px;
      margin: 20px 0;
      font-size: 13px;
      color: #4b5563;
      max-height: 200px;
      overflow: hidden;
      position: relative;
    }
    .proposal-preview::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: linear-gradient(to top, #f9fafb, transparent);
    }
    .footer {
      background-color: #f3f4f6;
      padding: 24px 20px;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 8px 0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GovChain Proposal Match</h1>
      <p>High-fit opportunity from ${proposal.agency}</p>
    </div>

    <div class="content">
      <div class="greeting">
        <p>Dear ${proposal.contact_person || 'Government Affairs Team'},</p>
        <p>We've identified a government opportunity that aligns exceptionally well with your agency's mission and our blockchain authentication capabilities. See details below.</p>
      </div>

      <div class="opportunity">
        <h3>${proposal.title}</h3>
        <p><strong>Agency:</strong> ${proposal.agency}</p>
        <p><strong>Deadline:</strong> ${proposal.deadline || 'Not specified'}</p>
        <div class="fit-score">${proposal.fit_score}/100 Match</div>
        <div class="fit-reason">${fitReason}</div>
      </div>

      <div class="proposal-preview">
        <strong>Proposal Summary:</strong>
        <p>${proposal.proposal_draft}</p>
      </div>

      <div class="cta-section">
        <p style="margin-top: 0; font-size: 14px;"><strong>Ready to discuss this opportunity?</strong></p>
        <a href="${calendarUrl}" class="btn btn-primary">Schedule Discovery Call</a>
        <a href="${detailsUrl}" class="btn btn-secondary">View Full Details</a>
      </div>

      <p style="font-size: 14px; color: #6b7280; text-align: center;">
        Have questions? Reach out to our government solutions team at <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>
      </p>
    </div>

    <div class="footer">
      <p><strong>AuthiChain — Blockchain Authentication for Government</strong></p>
      <p>This email was sent because your agency matches our high-fit criteria for blockchain authentication solutions.</p>
      <p>
        <a href="${GOVCHAIN}/preferences">Update Communication Preferences</a> |
        <a href="${GOVCHAIN}/unsubscribe">Unsubscribe</a>
      </p>
      <p>&copy; ${new Date().getFullYear()} AuthiChain. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateFitReason(fitScore: number): string {
  if (fitScore >= 90) {
    return 'Exceptional match: Your agency requires blockchain authentication for compliance and digital asset management, matching our core expertise in NFT-based government contracts and secure credential verification.';
  }
  if (fitScore >= 80) {
    return 'Strong match: Your procurement priorities align with our blockchain authentication and smart contract capabilities for federal acquisition and transparency requirements.';
  }
  if (fitScore >= 70) {
    return 'Good match: Your agency\'s needs include authentication and record-keeping where our blockchain solutions provide immutable verification and auditability.';
  }
  return 'Opportunity match: AuthiChain\'s authentication platform may support your agency\'s digital transformation goals.';
}

async function emailProposals(): Promise<{ sent: number; failed: number; total: number }> {
  const { data: proposals, error } = await supabase
    .from('gov_proposals')
    .select('*')
    .eq('email_status', 'unsent')
    .gte('fit_score', 70)
    .order('fit_score', { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!proposals?.length) {
    console.log('No proposals ready for email delivery.');
    return { sent: 0, failed: 0, total: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const proposal of proposals) {
    // Validate required fields
    if (!proposal.contact_email) {
      console.warn(`  ⚠️  Skipped ${proposal.notice_id}: no contact_email found`);
      continue;
    }

    try {
      const html = generateEmailHtml(proposal);
      const subject = `GovChain Proposal: ${proposal.agency} — ${proposal.fit_score}/100 Match`;

      if (!isDryRun) {
        const response = await resend.emails.send({
          from: FROM_EMAIL,
          to: proposal.contact_email,
          subject,
          html,
        });

        if (!response.data?.id) {
          throw new Error(`Resend returned no message ID: ${JSON.stringify(response.error)}`);
        }

        // Update proposal status to 'sent' and record timestamp
        await supabase
          .from('gov_proposals')
          .update({
            status: 'sent',
            email_status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('notice_id', proposal.notice_id);

        console.log(`  ✉️  Email sent: ${proposal.contact_email} (${proposal.notice_id}, fit=${proposal.fit_score})`);
        sent++;
      } else {
        // Dry run: log without sending
        console.log(`  [DRY RUN] Would email: ${proposal.contact_email} (${proposal.notice_id}, fit=${proposal.fit_score})`);
        console.log(`           Subject: ${subject}`);
        sent++;
      }
    } catch (err: any) {
      // Per-proposal failure: log and continue
      failed++;
      const shortMsg = (err?.message || String(err)).split('\n')[0].slice(0, 200);
      console.warn(`  ⚠️  Failed to email ${proposal.notice_id}: ${shortMsg}`);

      // Record failure in database (even in dry-run we track the attempt)
      if (!isDryRun) {
        try {
          await supabase
            .from('gov_proposals')
            .update({
              email_status: 'failed',
            })
            .eq('notice_id', proposal.notice_id);
        } catch {
          // Silently ignore DB update errors during failure handling
        }
      }
    }
  }

  return { sent, failed, total: proposals.length };
}

const { sent, failed, total } = await emailProposals();
console.log(`✅ Sent ${sent}/${total} proposal emails (${failed} failed)`);

// Only fail the job if we had work to do but accomplished none of it.
if (total > 0 && sent === 0) {
  console.error('❌ All email attempts failed — see errors above.');
  process.exit(1);
}
process.exit(0);
