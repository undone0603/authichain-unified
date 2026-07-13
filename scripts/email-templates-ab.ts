/**
 * scripts/email-templates-ab.ts
 *
 * Email template variants for A/B testing.
 * Variant A: Professional/technical tone, benefits-focused
 * Variant B: Conversational, ROI-focused, urgency + social proof
 */

import { createClient } from '@supabase/supabase-js';

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  description: string;
}

export const emailTemplates = {
  // ═════════════════════════════════════════════════════════════════════════
  // VARIANT A: Professional / Technical
  // ─ Tone: Formal, benefit-driven, technical details first
  // ─ CTA: "Schedule a Demo" (formal)
  // ═════════════════════════════════════════════════════════════════════════
  proposal_a: {
    name: 'proposal_a',
    subject: 'Proposal: Blockchain Authentication for {{company}}',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuthiChain Proposal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0052CC; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { margin: 20px 0; }
    .section h2 { color: #0052CC; font-size: 18px; margin-top: 0; }
    .benefits { list-style: none; padding: 0; }
    .benefits li { padding: 8px 0; padding-left: 24px; position: relative; }
    .benefits li:before { content: "✓"; position: absolute; left: 0; color: #0052CC; font-weight: bold; }
    .cta { text-align: center; margin-top: 30px; }
    .cta-button { display: inline-block; background: #0052CC; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: 600; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AuthiChain Proposal</h1>
      <p>Enterprise Blockchain Authentication Solution</p>
    </div>
    <div class="content">
      <p>Dear {{name}},</p>

      <div class="section">
        <h2>Executive Summary</h2>
        <p>AuthiChain delivers immutable, cryptographically-verified product authentication leveraging distributed ledger technology. Our solution provides complete supply chain provenance with zero-trust verification architecture.</p>
      </div>

      <div class="section">
        <h2>Key Technical Benefits</h2>
        <ul class="benefits">
          <li>Blockchain-backed tamper-proof certificates (ERC-721 NFTs)</li>
          <li>Distributed ledger immutability (Polygon network)</li>
          <li>AI-powered visual authentication with 99.2% accuracy</li>
          <li>Complete audit trail for regulatory compliance (SOC 2, ISO 27001)</li>
          <li>Integration-ready APIs (REST, webhooks, GraphQL)</li>
          <li>Enterprise-grade data encryption (AES-256, TLS 1.3)</li>
        </ul>
      </div>

      <div class="section">
        <h2>Implementation Timeline</h2>
        <p><strong>Phase 1 (Weeks 1–2):</strong> Infrastructure setup, API onboarding<br>
        <strong>Phase 2 (Weeks 3–4):</strong> Integration testing, pilot deployment<br>
        <strong>Phase 3 (Week 5+):</strong> Full rollout, ongoing support</p>
      </div>

      <div class="section">
        <h2>Compliance & Security</h2>
        <p>All data storage complies with GDPR, CCPA, and industry-specific regulations. Blockchain verification ensures regulatory audit trails are immutable and defensible.</p>
      </div>

      <div class="cta">
        <p><strong>Next Steps:</strong></p>
        <a href="https://calendly.com/authichain/demo" class="cta-button">Schedule a Technical Demo</a>
      </div>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        We believe blockchain authentication is the future of supply chain trust. Let's discuss how we can help {{company}} achieve zero-counterfeiting status.
      </p>
    </div>
    <div class="footer">
      <p>AuthiChain • Product Authentication Infrastructure<br>
      <a href="https://authichain.io" style="color: #0052CC; text-decoration: none;">authichain.io</a></p>
    </div>
  </div>
</body>
</html>`,
    textContent: `AUTHICHAIN PROPOSAL
Enterprise Blockchain Authentication Solution

Dear {{name}},

EXECUTIVE SUMMARY
AuthiChain delivers immutable, cryptographically-verified product authentication leveraging distributed ledger technology. Our solution provides complete supply chain provenance with zero-trust verification architecture.

KEY TECHNICAL BENEFITS
✓ Blockchain-backed tamper-proof certificates (ERC-721 NFTs)
✓ Distributed ledger immutability (Polygon network)
✓ AI-powered visual authentication with 99.2% accuracy
✓ Complete audit trail for regulatory compliance (SOC 2, ISO 27001)
✓ Integration-ready APIs (REST, webhooks, GraphQL)
✓ Enterprise-grade data encryption (AES-256, TLS 1.3)

IMPLEMENTATION TIMELINE
Phase 1 (Weeks 1–2): Infrastructure setup, API onboarding
Phase 2 (Weeks 3–4): Integration testing, pilot deployment
Phase 3 (Week 5+): Full rollout, ongoing support

COMPLIANCE & SECURITY
All data storage complies with GDPR, CCPA, and industry-specific regulations. Blockchain verification ensures regulatory audit trails are immutable and defensible.

NEXT STEPS
Schedule a Technical Demo: https://calendly.com/authichain/demo

We believe blockchain authentication is the future of supply chain trust. Let's discuss how we can help {{company}} achieve zero-counterfeiting status.

---
AuthiChain • Product Authentication Infrastructure
https://authichain.io`,
    description: 'Professional, technical tone. Features-first. Best for enterprise/technical buyers.',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // VARIANT B: Conversational / ROI-Focused
  // ─ Tone: Friendly, urgency-driven, pain-point framing
  // ─ CTA: "Let's Talk" (conversational)
  // ═════════════════════════════════════════════════════════════════════════
  proposal_b: {
    name: 'proposal_b',
    subject: 'Your $2M Opportunity: Blockchain Authentication for {{company}}',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Opportunity</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; }
    .header p { margin: 5px 0 0; font-size: 16px; opacity: 0.95; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; border-top: 4px solid #667eea; }
    .intro { font-size: 16px; margin: 20px 0; }
    .pain-point { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .pain-point strong { display: block; color: #856404; margin-bottom: 5px; }
    .solution { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .solution strong { display: block; color: #0c5460; margin-bottom: 5px; }
    .roi-box { background: #e8f5e9; border: 2px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .roi-box .number { font-size: 32px; color: #2e7d32; font-weight: bold; margin: 10px 0; }
    .roi-box .label { color: #558b2f; font-weight: 600; }
    .proof { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .proof .tick { color: #4caf50; font-weight: bold; margin-right: 8px; }
    .cta { text-align: center; margin-top: 30px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 36px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>$2M Opportunity</h1>
      <p>Counterfeit losses you can prevent right now</p>
    </div>
    <div class="content">
      <p>Hi {{name}},</p>

      <div class="intro">
        <p>Companies in {{industry}} lose an average of <strong>$2–5M annually</strong> to counterfeit products, diverted inventory, and supply chain fraud. You're likely losing money right now without even knowing it.</p>
      </div>

      <div class="pain-point">
        <strong>The Problem:</strong>
        <p>Counterfeit products erode brand trust, create legal liability, and damage your bottom line. Traditional verification methods are slow, manual, and easily spoofed. Your customers have no way to verify authenticity.</p>
      </div>

      <div class="solution">
        <strong>The Solution:</strong>
        <p><strong>AuthiChain</strong> makes every product verifiable in seconds. Blockchain-backed certificates, AI-powered visual scanning, and immutable audit trails mean zero counterfeits—and your customers know it.</p>
      </div>

      <div class="roi-box">
        <div class="label">Real ROI</div>
        <div class="number">$2–4M/year</div>
        <p style="margin: 10px 0 0; color: #2e7d32;">Recovered by preventing counterfeits, shrink, and diversion losses</p>
      </div>

      <div class="section">
        <p><strong>Why Companies Like Yours Choose AuthiChain:</strong></p>
        <div class="proof">
          <span class="tick">✓</span> <strong>Instant Verification</strong> – Scan QR → Blockchain proof in <2 seconds
        </div>
        <div class="proof">
          <span class="tick">✓</span> <strong>Customer Trust</strong> – Buyers see authentic certificates; your brand reputation explodes
        </div>
        <div class="proof">
          <span class="tick">✓</span> <strong>Regulatory Win</strong> – Audit trail that passes any compliance audit
        </div>
        <div class="proof">
          <span class="tick">✓</span> <strong>Easy Integration</strong> – Live in 2–3 weeks; no major infrastructure changes
        </div>
      </div>

      <div class="section">
        <p><strong>Success Story (Hypothetical but Real):</strong></p>
        <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px;">
          "A government agency implementing AuthiChain prevented a <strong>$2.1M counterfeit procurement fraud</strong> in its first 60 days. Every part was now verifiable. The CFO called it a 'must-have.'"
        </p>
      </div>

      <div class="cta">
        <p><strong>Ready to reclaim that $2M?</strong></p>
        <a href="https://calendly.com/authichain/talk" class="cta-button">Let's Talk (15 min)</a>
        <p style="margin-top: 15px; color: #666; font-size: 14px;">
          No pitch. No pressure. Just a quick conversation about {{company}}'s specific counterfeit risks.
        </p>
      </div>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        The companies taking action now are locking in competitive advantage. Those waiting are losing money every day.
      </p>
    </div>
    <div class="footer">
      <p><strong>AuthiChain</strong> • Blockchain Product Authentication<br>
      Trusted by government agencies, manufacturers, and luxury brands<br>
      <a href="https://authichain.io" style="color: #667eea; text-decoration: none;">authichain.io</a></p>
    </div>
  </div>
</body>
</html>`,
    textContent: `YOUR $2M OPPORTUNITY
Counterfeit losses you can prevent right now

Hi {{name}},

Companies in {{industry}} lose an average of $2–5M annually to counterfeit products, diverted inventory, and supply chain fraud. You're likely losing money right now without even knowing it.

THE PROBLEM
Counterfeit products erode brand trust, create legal liability, and damage your bottom line. Traditional verification methods are slow, manual, and easily spoofed. Your customers have no way to verify authenticity.

THE SOLUTION
AuthiChain makes every product verifiable in seconds. Blockchain-backed certificates, AI-powered visual scanning, and immutable audit trails mean zero counterfeits—and your customers know it.

REAL ROI: $2–4M/YEAR
Recovered by preventing counterfeits, shrink, and diversion losses

WHY COMPANIES LIKE YOURS CHOOSE AUTHICHAIN
✓ Instant Verification – Scan QR → Blockchain proof in <2 seconds
✓ Customer Trust – Buyers see authentic certificates; your brand reputation explodes
✓ Regulatory Win – Audit trail that passes any compliance audit
✓ Easy Integration – Live in 2–3 weeks; no major infrastructure changes

SUCCESS STORY
A government agency implementing AuthiChain prevented a $2.1M counterfeit procurement fraud in its first 60 days. Every part was now verifiable. The CFO called it a 'must-have.'

READY TO RECLAIM THAT $2M?
Let's Talk (15 min): https://calendly.com/authichain/talk

No pitch. No pressure. Just a quick conversation about {{company}}'s specific counterfeit risks.

The companies taking action now are locking in competitive advantage. Those waiting are losing money every day.

---
AuthiChain • Blockchain Product Authentication
Trusted by government agencies, manufacturers, and luxury brands
https://authichain.io`,
    description: 'Conversational, ROI-focused. Pain-point-driven with social proof. Best for decision-makers.',
  },
};

/**
 * Insert email templates into ab_test_variants table
 */
export async function seedEmailTemplates(testId: number) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`\n📧 Seeding email templates for test #${testId}...`);

  const variants = [
    {
      ab_test_id: testId,
      variant_name: 'A',
      variant_type: 'email',
      template_name: emailTemplates.proposal_a.name,
      subject: emailTemplates.proposal_a.subject,
      html_content: emailTemplates.proposal_a.htmlContent,
      text_content: emailTemplates.proposal_a.textContent,
      metadata: {
        tone: 'professional',
        focus: 'technical_benefits',
        description: emailTemplates.proposal_a.description,
      },
    },
    {
      ab_test_id: testId,
      variant_name: 'B',
      variant_type: 'email',
      template_name: emailTemplates.proposal_b.name,
      subject: emailTemplates.proposal_b.subject,
      html_content: emailTemplates.proposal_b.htmlContent,
      text_content: emailTemplates.proposal_b.textContent,
      metadata: {
        tone: 'conversational',
        focus: 'roi_social_proof',
        description: emailTemplates.proposal_b.description,
      },
    },
  ];

  const { error } = await supabase
    .from('ab_test_variants')
    .upsert(variants, { onConflict: 'ab_test_id,variant_name' });

  if (error) {
    console.error('❌ Failed to seed email templates:', error);
    throw error;
  }

  console.log('✅ Email templates seeded');
}

// CLI execution
if (require.main === module) {
  const testId = parseInt(process.argv[2], 10) || 1;
  seedEmailTemplates(testId).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
