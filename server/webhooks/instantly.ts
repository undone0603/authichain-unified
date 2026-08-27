/**
 * Instantly.ai Webhook Handler — server/webhooks/instantly.ts
 *
 * Handles email engagement events (opens, clicks, replies) and 
 * updates lead scoring in real-time.
 */

import {
  getLeadByEmail,
  updateLead,
  logActivity,
  createSystemNotification,
  hasWebhookEventProcessed
} from "../db.js";
import { calculateLeadScore } from "../sales/scoring-service.js";

export async function handleInstantlyWebhook(payload: any) {
  const { event: eventType, email, webhook_id: webhookId } = payload;

  if (!email) {
    return { success: false, error: "Email missing" };
  }

  // Prevent duplicate processing of the same webhook event
  const eventKey = webhookId || `${email}:${eventType}`;
  if (await hasWebhookEventProcessed(eventKey)) {
    console.log(`[instantly-webhook] Duplicate event ignored: ${eventKey.replace(/[\r\n]/g, " ")}`);
    return { success: true, duplicate: true };
  }

  console.log(`[instantly-webhook] Received ${eventType} for ${email}`);

  // 1. Find the lead in our DB
  const lead = await getLeadByEmail(email);
  if (!lead) {
    console.warn(`[instantly-webhook] Lead not found for email: ${email}`);
    return { success: false, error: "Lead not found" };
  }

  // 2. Update lead status flags
  const updates: any = {};
  
  if (eventType === "email_opened") {
    updates.emailOpened = true;
  } else if (eventType === "email_clicked") {
    updates.emailClicked = true;
  } else if (eventType === "email_replied") {
    updates.emailReplied = true;
    
    // Notify sales team of a reply
    await createSystemNotification(
      1, // Admin
      "New Prospect Reply",
      `Lead ${email} has replied to an outreach sequence. Check Gmail immediately.`,
      "system",
      "/email-campaigns"
    );
  }

  if (Object.keys(updates).length > 0) {
    await updateLead(lead.id, updates);
  }

  // 3. Log activity for the audit trail
  await logActivity({
    userId: null,
    action: `instantly_${eventType}`,
    entityType: "lead",
    entityId: lead.id,
    details: payload
  });

  // 4. Recalculate lead score and potentially trigger auto-contract
  const newScore = await calculateLeadScore(lead.id);
  
  console.log(`[instantly-webhook] Lead ${email} score updated to ${newScore}`);

  return { success: true, score: newScore };
}
