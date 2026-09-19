import { describe, it, expect } from "vitest";
import {
  CHANNEL_PARTNER_LEAD_SOURCE,
  CHANNEL_PARTNER_TARGETS,
  SKIPPED_CHANNEL_PARTNER_RESEARCH,
  allowPartnerLiveSends,
  assertPartnerRunAllowed,
  loadChannelPartnerFile,
  shouldLoadPartnerTargets,
} from "./channel-partners.ts";

describe("channel-partner list", () => {
  it("loads nine emailable partners with role channel_partner", () => {
    expect(CHANNEL_PARTNER_TARGETS).toHaveLength(9);
    for (const partner of CHANNEL_PARTNER_TARGETS) {
      expect(partner.role).toBe("channel_partner");
      expect(partner.email).toMatch(/@/);
      expect(partner.company.length).toBeGreaterThan(0);
      expect(partner.notes.length).toBeGreaterThan(0);
    }
  });

  it("keeps the published / inbound addresses from the 2026-09-19 scan", () => {
    const emails = CHANNEL_PARTNER_TARGETS.map(p => p.email);
    expect(emails).toEqual(
      expect.arrayContaining([
        "contact@existosolutions.com",
        "info@icsconsultingservice.com",
        "helpteam@oakleysign.com",
        "hello@pufcreativ.com",
        "apexaccelerator@nemcworks.org",
        "fitzpatricks@nemcworks.org",
        "mooret@nemcworks.org",
        "mcmanuss@nemcworks.org",
        "info@onnit.com",
      ])
    );
  });

  it("marks Oakley as already connected and Onnit as inbound-warm", () => {
    const oakley = CHANNEL_PARTNER_TARGETS.find(
      p => p.company === "Oakley Signs"
    );
    const onnit = CHANNEL_PARTNER_TARGETS.find(p => p.company === "Onnit");
    expect(oakley?.already_connected).toBe(true);
    expect(oakley?.source).toBe("confirmed_reply");
    expect(onnit?.inbound_warm).toBe(true);
    expect(onnit?.source).toBe("inbound_optin");
  });

  it("documents URL-only agencies and DPP consultancies as not auto-send", () => {
    const names = SKIPPED_CHANNEL_PARTNER_RESEARCH.map(s => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Canna Banana",
        "HighMinded",
        "Magic Plants",
        "GO TRACE",
        "Provenant",
        "DPP Agency",
      ])
    );
    expect(CHANNEL_PARTNER_TARGETS.some(p => names.includes(p.company))).toBe(
      false
    );
  });

  it("rejects a file that would auto-include an untrusted source", () => {
    expect(() =>
      loadChannelPartnerFile(
        JSON.stringify({
          source: CHANNEL_PARTNER_LEAD_SOURCE,
          generated: "2026-09-19",
          role: "channel_partner",
          skipped_not_auto_send: [],
          partners: [
            {
              company: "Guess Co",
              name: "Guess",
              email: "compliance@guess.example",
              segment: "strainchain",
              role: "channel_partner",
              notes: "pattern guess",
              source: "unknown",
            },
          ],
        })
      )
    ).toThrow(/not trusted/);
  });
});

describe("partner segment gate", () => {
  it("does not load partners for all / product cold segments", () => {
    expect(shouldLoadPartnerTargets("all")).toBe(false);
    expect(shouldLoadPartnerTargets("govchain")).toBe(false);
    expect(shouldLoadPartnerTargets("strainchain")).toBe(false);
    expect(shouldLoadPartnerTargets("qron")).toBe(false);
    expect(shouldLoadPartnerTargets("partners")).toBe(true);
  });

  it("allows dry-run partner loads without an extra flag", () => {
    expect(
      assertPartnerRunAllowed({ isDryRun: true, allowLive: false })
    ).toEqual({ ok: true });
  });

  it("refuses live partner sends unless ALLOW_PARTNER_SENDS is explicit", () => {
    const denied = assertPartnerRunAllowed({
      isDryRun: false,
      allowLive: false,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.message).toMatch(/ALLOW_PARTNER_SENDS/);
      expect(denied.message).toMatch(/MAX_LIVE_SENDS/);
    }
    expect(
      assertPartnerRunAllowed({ isDryRun: false, allowLive: true })
    ).toEqual({ ok: true });
  });

  it("reads ALLOW_PARTNER_SENDS=true or --allow-partner-sends only", () => {
    expect(allowPartnerLiveSends({}, [])).toBe(false);
    expect(allowPartnerLiveSends({ ALLOW_PARTNER_SENDS: "false" }, [])).toBe(
      false
    );
    expect(allowPartnerLiveSends({ ALLOW_PARTNER_SENDS: "true" }, [])).toBe(
      true
    );
    expect(allowPartnerLiveSends({}, ["--allow-partner-sends"])).toBe(true);
  });
});
