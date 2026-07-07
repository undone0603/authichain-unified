/**
 * CRM Client — HTTP wrapper for Twenty CRM / HubSpot.
 * Swap the base URL and auth header for your CRM of choice.
 * All methods are fire-and-forget safe (errors logged, never thrown).
 */

const CRM_BASE_URL = process.env.CRM_BASE_URL ?? '';
const CRM_API_KEY = process.env.CRM_API_KEY ?? '';

export interface CrmContact {
  email: string;
  stripe_customer_id?: string;
  domain?: string;
  name?: string;
}

export interface CrmDeal {
  brand: string;
  deal_type: string;
  plan_id?: string;
  mrr_usd?: number;
  scan_volume?: number;
  email?: string;
  dispensary_id?: string;
  certificate_id?: string;
  stage?: string;
}

async function crmFetch(
  path: string,
  body: Record<string, unknown>,
  method = 'POST',
): Promise<void> {
  if (!CRM_BASE_URL || !CRM_API_KEY) {
    console.warn('[crm/client] CRM_BASE_URL or CRM_API_KEY not configured — skipping');
    return;
  }
  try {
    const res = await fetch(`${CRM_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRM_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('[crm/client] CRM request failed', path, res.status, await res.text());
    }
  } catch (err) {
    console.error('[crm/client] CRM fetch error', path, err);
  }
}

export const crmClient = {
  /** Create or update a contact by email */
  async upsertContact(contact: CrmContact): Promise<void> {
    await crmFetch('/contacts', contact);
  },

  /** Create a new deal */
  async createDeal(deal: CrmDeal): Promise<void> {
    await crmFetch('/deals', deal);
  },

  /** Advance deal stage or update a metric */
  async updateDeal(deal: Partial<CrmDeal> & { deal_type: string; brand: string }): Promise<void> {
    await crmFetch('/deals/update', deal);
  },

  /** Generic emit — used by revenue-engine/handlers.ts */
  async emit(action: string, payload: Record<string, unknown>): Promise<void> {
    await crmFetch('/events', { action, ...payload });
  },
};
