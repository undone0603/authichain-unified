import { logAutomation, formatErr } from '../automation';

interface HubSpotDeal {
  id: string;
  properties: Record<string, string>;
}

/**
 * Detects HubSpot deals that have stalled in mid-funnel stages and nudges
 * them forward (records an internal note, logs the touch). The real
 * deliverable-generation logic still needs to be plugged in — this stub is
 * safe to run: it no-ops when no token is configured, and surfaces failures
 * through logAutomation rather than raising.
 */
export class HubSpotDeliverableAgent {
  private readonly token = process.env.HUBSPOT_ACCESS_TOKEN;
  private readonly workflowName = 'hubspot_unblock_stalled_deals';

  async unblockStalledDeals(): Promise<void> {
    if (!this.token) {
      await logAutomation(this.workflowName, 'cron', 'success', { skipped: 'no HUBSPOT_ACCESS_TOKEN' });
      return;
    }

    try {
      const deals = await this.fetchStalledDeals();
      let touched = 0;
      for (const deal of deals) {
        const ok = await this.recordTouch(deal);
        if (ok) touched++;
      }
      await logAutomation(this.workflowName, 'cron', 'success', { deals: deals.length, touched });
    } catch (err) {
      await logAutomation(this.workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  private async fetchStalledDeals(): Promise<HubSpotDeal[]> {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    const url =
      'https://api.hubapi.com/crm/v3/objects/deals?limit=50&properties=dealname,dealstage,hs_lastmodifieddate&filterGroups=' +
      encodeURIComponent(
        JSON.stringify([
          {
            filters: [
              { propertyName: 'dealstage', operator: 'IN', values: ['qualifiedtobuy', 'presentationscheduled', 'decisionmakerboughtin'] },
              { propertyName: 'hs_lastmodifieddate', operator: 'LT', value: cutoff },
            ],
          },
        ]),
      );

    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HubSpot deal query failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: HubSpotDeal[] };
    return data.results ?? [];
  }

  private async recordTouch(deal: HubSpotDeal): Promise<boolean> {
    try {
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hs_note_body: 'AuthiChain autonomous follow-up: deal flagged for deliverable generation.',
            hs_timestamp: Date.now(),
          },
          associations: [
            {
              to: { id: deal.id },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
            },
          ],
        }),
      });
      if (!res.ok) {
        console.warn(`[hubspot] note insert failed for deal ${deal.id}: ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[hubspot] note insert threw for deal ${deal.id}:`, err);
      return false;
    }
  }
}
