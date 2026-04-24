import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";

/**
 * Trigger Human Handshake SMS alert
 * This bypasses the legacy sales cycle by alerting the founder directly.
 */
export async function triggerHumanHandshake(lead: {
  name: string;
  company: string;
  phone?: string;
  email: string;
  context: string;
}) {
  const title = `🚨 URGENT: High-Intent Lead Handshake`;
  const content = `
Founder Alert: Immediate Handshake Required
-------------------------------------------
Lead: ${lead.name}
Company: ${lead.company}
Email: ${lead.email}
Phone: ${lead.phone || 'N/A'}
Context: ${lead.context}

Action: Text them immediately to bypass the corporate sales cycle.
1-click Text: sms:${lead.phone || ''}?body=Hi%20${lead.name},%20I'm%20the%20founder%20of%20AuthiChain.%20I%20saw%20your%20interest...
  `.trim();

  // 1. Notify via internal system notification
  await notifyOwner({ title, content });

  // 2. If Make.com webhook is configured, send a direct SMS payload
  if (ENV.makeWebhookUrl && ENV.smsRecipient) {
    try {
      await fetch(ENV.makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ENV.smsRecipient,
          message: content,
          leadName: lead.name,
          leadPhone: lead.phone
        })
      });
    } catch (err) {
      console.warn("[SMS Handshake] Webhook failed:", err);
    }
  }
}
