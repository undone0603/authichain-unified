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
  createSystemNotification 
} from "../db.js";
import { calculateLeadScore } from "../sales/scoring-service.js";

export async function handleInstantlyWebhook(payload: any) {
  const { event: eventType, email, lead_id: instantlyLeadId } = payload;
  
  if (!email) {
    return { success: false, error: "Email missing" };
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
