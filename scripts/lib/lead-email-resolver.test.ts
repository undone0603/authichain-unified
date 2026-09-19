import { describe, it, expect, beforeEach } from "vitest";
import {
  findTrustedCrmEmail,
  findTrustedHubSpotEmail,
  resolveLeadEmail,
  apolloFindEmail,
  describeSkipReason,
  resetLeadEmailResolverState,
} from "./lead-email-resolver";

beforeEach(() => {
  resetLeadEmailResolverState();
  delete process.env.APOLLO_API_KEY;
});

describe("findTrustedCrmEmail", () => {
  it("reuses a CRM row whose metadata.source is trusted", () => {
    const hit = findTrustedCrmEmail("FASTSIGNS", [
      {
        company: "FASTSIGNS",
        email: "franchiseinfo@fastsigns.com",
        metadata: { source: "published_contact" },
      },
    ]);
    expect(hit).toEqual({
      email: "franchiseinfo@fastsigns.com",
      source: "published_contact",
      via: "crm_trusted",
    });
  });

  it("ignores pending placeholders and untrusted provenance", () => {
    expect(
      findTrustedCrmEmail("Curaleaf", [
        {
          company: "Curaleaf",
          email: "[pending]@curaleaf.com",
          metadata: { source: "published_contact" },
        },
        {
          company: "Curaleaf",
          email: "compliance@curaleaf.com",
          metadata: { source: "unknown" },
        },
      ])
    ).toBeNull();
  });
});

describe("findTrustedHubSpotEmail", () => {
  it("accepts an inbound lifecycle contact", () => {
    const hit = findTrustedHubSpotEmail("MOO", [
      {
        properties: {
          email: "ada@moo.com",
          company: "MOO",
          lifecyclestage: "opportunity",
        },
      },
    ]);
    expect(hit).toEqual({
      email: "ada@moo.com",
      source: "inbound_optin",
      via: "hubspot_inbound",
    });
  });

  it("refuses a HubSpot email with no inbound provenance", () => {
    const hit = findTrustedHubSpotEmail("MOO", [
      {
        properties: {
          email: "ada@moo.com",
          company: "MOO",
          lifecyclestage: "other",
          hs_analytics_source: "PAID_SEARCH",
        },
      },
    ]);
    expect(hit?.via).toBe("hubspot_untrusted_provenance");
    expect(hit?.email).toBe("");
  });
});

describe("apolloFindEmail", () => {
  it("returns apollo_unconfigured when the secret is missing", async () => {
    const result = await apolloFindEmail(
      "Ada Lovelace",
      "MOO",
      "https://moo.com"
    );
    expect(result).toEqual({ email: "", skip: "apollo_unconfigured" });
  });

  it("latches apollo_plan_blocked on 403 API_INACCESSIBLE and skips later calls", async () => {
    process.env.APOLLO_API_KEY = "test-key";
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error_code: "API_INACCESSIBLE" }), {
        status: 403,
      })) as typeof fetch;

    const first = await apolloFindEmail(
      "Ada",
      "MOO",
      "https://moo.com",
      fetchImpl
    );
    expect(first.skip).toBe("apollo_plan_blocked");

    let called = 0;
    const secondFetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const second = await apolloFindEmail(
      "Ada",
      "MOO",
      "https://moo.com",
      secondFetch
    );
    expect(second.skip).toBe("apollo_plan_blocked");
    expect(called).toBe(0);
  });
});

describe("resolveLeadEmail", () => {
  it("keeps an explicit published address", async () => {
    const result = await resolveLeadEmail({
      company: "FASTSIGNS",
      email: "franchiseinfo@fastsigns.com",
      source: "published_contact",
    });
    expect(result.via).toBe("already_set");
    expect(result.email).toBe("franchiseinfo@fastsigns.com");
  });

  it("prefers CRM over Apollo", async () => {
    process.env.APOLLO_API_KEY = "test-key";
    const result = await resolveLeadEmail(
      { company: "MOO", name: "Product" },
      {
        crmRows: [
          {
            company: "MOO",
            email: "inquiries@moo.com",
            metadata: { source: "published_contact" },
          },
        ],
        fetchImpl: (async () => {
          throw new Error("apollo should not be called");
        }) as typeof fetch,
      }
    );
    expect(result.via).toBe("crm_trusted");
    expect(result.email).toBe("inquiries@moo.com");
  });

  it("explains a missing Apollo key", () => {
    expect(describeSkipReason("apollo_unconfigured")).toMatch(
      /APOLLO_API_KEY unset/
    );
    expect(describeSkipReason("apollo_plan_blocked")).toMatch(
      /do not upgrade Apollo/
    );
  });
});
