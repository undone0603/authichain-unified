import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifySend,
  decideOperatorAction,
  selectNextSendCandidate,
} from "../revenue-operator";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const campaignPath = path.join(
  root,
  "scripts/data/campaigns/first-customer-2026-10-29.json"
);

const VALID = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
  "pattern_guess",
  "scraped",
  "unknown",
]);

describe("first-customer campaign compliance", () => {
  const campaign = JSON.parse(readFileSync(campaignPath, "utf8"));

  it("has 25 prospects and 10 priority ids that exist", () => {
    expect(campaign.prospects).toHaveLength(25);
    expect(campaign.priority10).toHaveLength(10);
    const ids = new Set(campaign.prospects.map((p: { id: string }) => p.id));
    for (const id of campaign.priority10) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("selects robert@joinclab.com via confirmed_reply without inventing revenue", () => {
    const candidates = [];
    for (const p of campaign.prospects) {
      if (!campaign.priority10.includes(p.id) || !p.contact_channel) continue;
      let source = p.verification_source || "unknown";
      if (!VALID.has(source)) source = "unknown";
      candidates.push({ email: p.contact_channel, source });
    }
    const selected = selectNextSendCandidate(candidates);
    expect(selected.allowed).toBe(true);
    expect(selected.to).toBe("robert@joinclab.com");

    const decision = decideOperatorAction({
      rails: { ok: true, reason: "skipped", results: [] },
      snapshot: { subscriptions: [], payouts: [], charges: [] },
      candidates,
    });
    expect(decision.action).toBe("send_one");
    expect(decision.to).toBe("robert@joinclab.com");
    expect(decision.revenue.qualifying).toBe(false);

    expect(
      classifySend({
        namedInboxThisTurn: null,
        operatorSelectedInbox: "scott.krupa@fastsigns.com",
        source: "unknown",
      }).allowed
    ).toBe(false);
  });
});
