import { syncLeadToHubSpot, isHubSpotConfigured } from '../hubspot-service.js';
import { logActivity, getDb } from '../db.js';
import { leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface CrmUpdatePayload {
  segment?: string;
  dealStage?: string;
  leadEmail?: string;
  leadName?: string;
  leadOrg?: string;
}

export async function runCrmUpdate(task: Task): Promise<void> {
  const payload = task.payload as CrmUpdatePayload;

  if (!isHubSpotConfigured()) {
    await logActivity({ userId: null, action: 'crm_update_skipped', entityType: 'task', entityId: 0, details: { taskId: task.id, reason: 'hubspot_not_configured' } });
    return;
  }

  const db = await getDb();

  if (payload.leadEmail) {
    await syncLeadToHubSpot({
      email: payload.leadEmail,
      name: payload.leadName,
      company: payload.leadOrg,
    });

    if (db) {
      await db.update(leads)
        .set({ updatedAt: new Date() })
        .where(eq(leads.email, payload.leadEmail.toLowerCase()));
    }

    await logActivity({ userId: null, action: 'crm_lead_synced', entityType: 'task', entityId: 0, details: { taskId: task.id,
      leadEmail: payload.leadEmail,
      segment: payload.segment,
    }});
    return;
  }

  // Bulk sync: push all leads for this segment
  if (!db) return;

  const segmentLeads = payload.segment
    ? await db.select().from(leads).where(eq(leads.segment, payload.segment))
    : await db.select().from(leads);

  let synced = 0;
  for (const lead of segmentLeads) {
    try {
      await syncLeadToHubSpot({
        email: lead.email,
        name: lead.name ?? undefined,
        company: lead.company ?? undefined,
      });
      synced++;
    } catch {
      // continue on individual failures
    }
  }

  await logActivity({ userId: null, action: 'crm_bulk_sync_completed', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment: payload.segment,
    total: segmentLeads.length,
    synced,
    missionId: task.missionId,
  }});
}
