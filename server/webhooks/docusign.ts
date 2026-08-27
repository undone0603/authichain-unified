/**
 * DocuSign Webhook Handler — server/webhooks/docusign.ts
 *
 * Tracks contract lifecycle (sent, delivered, completed) and
 * updates deal status in the sales pipeline.
 */

import {
  getLeadByEmail,
  updateLead,
  logActivity,
  createSystemNotification,
  hasWebhookEventProcessed
} from "../db.js";
import { calculateLeadScore } from "../sales/scoring-service.js";

export async function handleDocuSignWebhook(payload: any) {
  const { event: eventType, recipientEmail, envelopeId, webhook_id: webhookId } = payload;

  if (!recipientEmail) {
    return { success: false, error: "Recipient email missing" };
  }

  // Prevent duplicate processing of the same webhook event
  const eventKey = webhookId || envelopeId || `${recipientEmail}:${eventType}`;
  if (await hasWebhookEventProcessed(eventKey)) {
    console.log(`[docusign-webhook] Duplicate event ignored: ${eventKey.replace(/[\r\n]/g, " ")}`);
    return { success: true, duplicate: true };
  }

  console.log(`[docusign-webhook] Received ${eventType} for ${recipientEmail}`);

  // 1. Find the lead in our DB
  const lead = await getLeadByEmail(recipientEmail);
  if (!lead) {
    console.warn(`[docusign-webhook] Lead not found for email: ${recipientEmail}`);
    return { success: false, error: "Lead not found" };
  }

  // 2. Update lead status flags
  const updates: any = {};
  
  if (eventType === "envelope-sent") {
    updates.contractSent = true;
  } else if (eventType === "envelope-delivered") {
    updates.contractOpened = true;
  } else if (eventType === "envelope-completed") {
    updates.contractSigned = true;
    updates.dealStage = "CLOSED_WON";
    
    // 🎉 Notify sales team of a closed deal
    await createSystemNotification(
      1, // Admin
      "🎉 DEAL CLOSED!",
      `Prospect ${recipientEmail} (${lead.company}) has signed the AuthiChain MSA!`,
      "system",
      "/admin/revenue"
    );
  } else if (eventType === "envelope-declined") {
    updates.dealStage = "DECLINED";
  }

  if (Object.keys(updates).length > 0) {
    await updateLead(lead.id, updates);
  }

  // 3. Log activity for the audit trail
  await logActivity({
    userId: null,
    action: `docusign_${eventType}`,
    entityType: "lead",
    entityId: lead.id,
    details: payload
  });

  // 4. Recalculate lead score
  const newScore = await calculateLeadScore(lead.id);
  
  console.log(`[docusign-webhook] Lead ${recipientEmail} status updated after DocuSign event.`);

  return { success: true, score: newScore };
}
