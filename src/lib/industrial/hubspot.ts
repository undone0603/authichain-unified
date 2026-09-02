import { generateLivingQR } from "../hf-generation";
import { anchorEdgeHash } from "../blockchain";
import { supabaseAdmin as admin } from "@/lib/supabase-admin";

/**
 * HUBSPOT DEAL & DELIVERABLE AGENT
 * Unblocks stalled drip sequencers by providing tangible artifacts.
 */

export interface HubSpotDealMetadata {
  type?: string;
  style?: string;
  identity?: string;
  batch?: string;
  rfid?: string;
}

export interface HubSpotDeal {
  id: string;
  dealname: string;
  dealstage: string;
  amount?: string;
  metadata?: HubSpotDealMetadata;
}

interface HubSpotDealSearchResponse {
  results?: Array<{
    id: string;
    properties?: {
      dealname?: string;
      dealstage?: string;
      amount?: string;
      deliverable_type?: string;
    };
  }>;
}

export class HubSpotDeliverableAgent {
  private hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

  /**
   * Main cycle: Fetch deals -> Generate Deliverables -> Update HubSpot
   */
  async unblockStalledDeals() {
    console.log("[HubSpot-Agent] Initiating unblock cycle...");
    if (!this.hubspotToken) {
      console.warn(
        "[HubSpot-Agent] HUBSPOT_ACCESS_TOKEN missing - skipping cycle"
      );
      return;
    }

    try {
      // 1. Fetch Deals in 'Waiting for Deliverable' stage (Mocked logic)
      const deals = await this.fetchPendingDeals();
      console.log(
        `[HubSpot-Agent] Found ${deals.length} deals waiting for deliverables.`
      );

      for (const deal of deals) {
        await this.processDeal(deal);
      }
    } catch (err) {
      console.error("[HubSpot-Agent] Cycle failed:", err);
    }
  }

  private async fetchPendingDeals(): Promise<HubSpotDeal[]> {
    if (!this.hubspotToken) return [];
    try {
      const res = await fetch(
        "https://api.hubapi.com/crm/v3/objects/deals/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.hubspotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "hs_is_closed",
                    operator: "EQ",
                    value: "false",
                  },
                ],
              },
            ],
            properties: ["dealname", "dealstage", "amount", "deliverable_type"],
            limit: 10,
            sorts: [
              { propertyName: "hs_lastmodifieddate", direction: "DESCENDING" },
            ],
          }),
        }
      );
      if (!res.ok) {
        console.warn("[HubSpot-Agent] search API error:", res.status);
        return [];
      }
      const data = (await res.json()) as HubSpotDealSearchResponse;
      return (data.results || []).map(d => ({
        id: d.id,
        dealname: d.properties?.dealname || "Unnamed Deal",
        dealstage: d.properties?.dealstage || "",
        amount: d.properties?.amount,
        metadata: { type: d.properties?.deliverable_type || "qron_design" },
      }));
    } catch (err) {
      console.error("[HubSpot-Agent] fetchPendingDeals error:", err);
      return [];
    }
  }

  private async processDeal(deal: HubSpotDeal) {
    console.log(`[HubSpot-Agent] Processing deliverable for: ${deal.dealname}`);

    try {
      let artifactUrl = "";
      const type = deal.metadata?.type;

      // 2. Generate specialized deliverables using existing Phase 2/3 infrastructure
      switch (type) {
        case "anchor_proof":
          // Phase 2 logic: Anchor a mock state for the pilot
          const mockHash = `0x${Buffer.from(
            `${deal.id}:${deal.metadata?.identity ?? ""}`
          )
            .toString("hex")
            .slice(0, 64)}`;
          const anchor = await anchorEdgeHash(
            mockHash,
            `pilot:${deal.dealname}`
          );
          artifactUrl = `https://polygonscan.com/tx/${anchor.txHash}`;
          break;

        case "qron_design":
        case "living_qron":
          // Phase 3 logic: Generate premium brand QRON
          const gen = await generateLivingQR({
            url: "https://qron.space/demo/pilot",
            prompt:
              deal.dealname +
              ", " +
              (deal.metadata?.style || "premium industrial"),
            qr_weight: 1.5,
          });
          artifactUrl = gen.imageUrl;
          break;

        case "state_hash_report":
        case "industrial_cert":
          // Generate a link to a dynamic verification page
          artifactUrl = `https://qron.space/p/pilot-${deal.id}`;
          break;
      }

      // 3. Attach Deliverable to HubSpot Deal
      await this.updateHubSpotDeal(deal.id, artifactUrl);
    } catch (err) {
      console.error("[HubSpot-Agent] processDeal error:", err);
    }
  }

  private async updateHubSpotDeal(dealId: string, artifactUrl: string) {
    if (!this.hubspotToken) return;
    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.hubspotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          deliverable_url: artifactUrl,
          dealstage: "presentationscheduled",
        },
      }),
    }).catch(err => {
      console.error("[HubSpot-Agent] updateHubSpotDeal error:", err);
    });

    await admin.from("automation_logs").insert({
      workflow_name: "hubspot_deliverable_attached",
      trigger_type: "event",
      status: "success",
      payload: JSON.stringify({ dealId, artifactUrl }),
    });
  }
}
