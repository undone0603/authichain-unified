import { describe, expect, it } from "vitest";
import {
  classifyAirtableAccount,
  classifyApolloLead,
  classifyHubSpotContact,
  classifyHubSpotDeal,
} from "../revenue-crm";

describe("classifyHubSpotContact", () => {
  it("does not treat a HubSpot row as a send list", () => {
    const named = classifyHubSpotContact({
      email: "heather@valentinedistilling.com",
      firstname: "Heather",
      lastname: "Valentine",
    });
    expect(named.namedHuman).toBe(true);
    expect(named.source).toBe("unknown");
    expect(named.doNotContact).toBe(false);
  });

  it("rejects Test Lead and missing names", () => {
    expect(
      classifyHubSpotContact({
        email: "ops@example.com",
        firstname: "Test",
        lastname: "Lead",
      }).namedHuman
    ).toBe(false);
    expect(
      classifyHubSpotContact({ email: "ops@example.com" }).namedHuman
    ).toBe(false);
  });

  it("marks founder, bounced, and connect-only Curaleaf mail do-not-contact", () => {
    expect(
      classifyHubSpotContact({
        email: "undone.k@gmail.com",
        firstname: "Zach",
        lastname: "Kietzman",
      }).doNotContact
    ).toBe(true);
    expect(
      classifyHubSpotContact({
        email: "beth.ferracone@curaleaf.com",
        firstname: "Beth",
        lastname: "Ferracone",
      }).doNotContact
    ).toBe(true);
    expect(
      classifyHubSpotContact({
        email: "wendy.linscott@curaleaf.com",
        firstname: "Wendy",
        lastname: "Linscott",
      }).doNotContact
    ).toBe(true);
  });
});

describe("classifyHubSpotDeal", () => {
  it("does not count scan/XP milestone deals as revenue", () => {
    const theater = classifyHubSpotDeal({
      dealname: "High-Activity User: ops@example.com (80 scans)",
      amount: "999",
    });
    expect(theater.countsAsRevenue).toBe(false);
    expect(
      classifyHubSpotDeal({
        dealname: "Power Agent: ops@example.com (900 XP)",
        amount: "2499",
      }).countsAsRevenue
    ).toBe(false);
  });

  it("does not treat a closed-won HubSpot deal as Stripe cash", () => {
    expect(
      classifyHubSpotDeal({
        dealname: "AuthiChain strainchain_farm - ops@example.com",
        amount: "149",
      }).countsAsRevenue
    ).toBe(false);
  });
});

describe("classifyAirtableAccount", () => {
  it("blocks demo rows and fabricated seed", () => {
    expect(
      classifyAirtableAccount({ name: "BioShield", status: "Prospect" })
        .doNotContact
    ).toBe(true);
    expect(
      classifyAirtableAccount({ name: "LVMH", status: "Prospect" }).doNotContact
    ).toBe(true);
  });

  it("blocks churned Mendo / RealTHCV", () => {
    const mendo = classifyAirtableAccount({
      name: "Mendo Love Farms",
      status: "Churned",
      email: "realthcv@gmail.com",
    });
    expect(mendo.doNotContact).toBe(true);
  });

  it("does not auto-send a live prospect", () => {
    const iron = classifyAirtableAccount({
      name: "Iron Fish Distillery",
      status: "Prospect",
      email: "sales@ironfishdistillery.com",
    });
    expect(iron.doNotContact).toBe(false);
    expect(iron.source).toBe("unknown");
  });
});

describe("classifyApolloLead", () => {
  it("maps verified vs guessed the same way as apollo-service", () => {
    const verified = classifyApolloLead({
      email: "jane.doe@dispensary.com",
      firstName: "Jane",
      lastName: "Doe",
      emailStatus: "verified",
    });
    expect(verified.source).toBe("apollo_verified");
    expect(verified.namedHuman).toBe(true);

    const guessed = classifyApolloLead({
      email: "bernard.arnault@lvmh.com",
      firstName: "Bernard",
      lastName: "Arnault",
      emailStatus: "guessed",
    });
    expect(guessed.source).toBe("pattern_guess");
  });

  it("drops locked Apollo placeholders", () => {
    const locked = classifyApolloLead({
      email: "email_not_unlocked@domain.com",
      firstName: "Jane",
      lastName: "Doe",
      emailStatus: "verified",
    });
    expect(locked.doNotContact).toBe(true);
  });
});
