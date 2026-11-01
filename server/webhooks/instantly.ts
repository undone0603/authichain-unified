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
import { assessInstantlyReply } from "./instantly-reply-evidence.js";

export async function handleInstantlyWebhook(payload: any) {
  const { event: eventType, email, webhook_id: webhookId } = payload;

  if (!email) {
    return { success: false, error: "Email missing" };
  }

  // Prevent duplicate processing of the same webhook event
  const eventKey = webhookId || `${email}:${eventType}`;
  if (await hasWebhookEventProcessed(eventKey)) {
    console.log("[instantly-webhook] Duplicate event ignored:", JSON.stringify(eventKey));
    return { success: true, duplicate: true };
  }

  console.log(`[instantly-webhook] Received ${eventType} for ${email}`);

  // 1. Find the lead in our DB
  const lead = await getLeadByEmail(email);
  if (!lead) {
    console.warn(`[instantly-webhook] Lead not found for email: ${email}`);
    return { success: false, error: "Lead not found" };
  }

  // 2. Update lead status flags. A vendor reply event is not human proof.
  const updates: any = {};
  const replyReview = eventType === "email_replied" ? assessInstantlyReply(payload) : null;
  
  if (eventType === "email_opened") {
    updates.emailOpened = true;
  } else if (eventType === "email_clicked") {
    updates.emailClicked = true;
  } else if (eventType === "email_replied" && replyReview?.status === "review") {
    // Notify for review, but never mark emailReplied or advance a warm lead.
    await createSystemNotification(
      1, // Admin
      "Prospect Reply Requires Verification",
      `A candidate reply for ${email} needs authenticated human/opt-in evidence before qualification.`,
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
  const newScore = Object.keys(updates).length > 0
    ? await calculateLeadScore(lead.id)
    : null;
  
  console.log(`[instantly-webhook] Lead ${email} score updated to ${newScore}`);

  return { success: true, score: newScore, replyReview };
}
