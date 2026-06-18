import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Coverage for the closed-won → fee_flows revenue capture in the daily
// autonomous cycle. All of the controller's siblings are mocked so importing it
// stays light, and Supabase + fetch are stubbed so the test touches no network.

const { logAutomation, createClient } = vi.hoisted(() => ({
  logAutomation: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("./automation", () => ({ logAutomation, formatErr: (e: unknown) => String(e) }));
vi.mock("./webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("./industrial/hubspot", () => ({ HubSpotDeliverableAgent: class { async unblockStalledDeals() {} } }));
vi.mock("./email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true, provider: "smtp" }) }));

import { AutonomousController } from "./autonomous-controller";

// The controller caches its Supabase admin client at module scope, so createClient
// is only ever called once across the suite. We therefore return ONE stable admin
// whose existing-rows lookup reads a mutable `existingRows` the tests set, rather
// than a fresh admin per test (which the cache would ignore).
let existingRows: unknown[] = [];
const insertSpy = vi.fn();
const query = {
  select: vi.fn(() => query),
  contains: vi.fn(() => query),
  limit: vi.fn(() => Promise.resolve({ data: existingRows, error: null })),
  insert: insertSpy,
};
const stableAdmin = { from: vi.fn(() => query) };

function hubspotResponse(deals: Array<{ id: string; properties: Record<string, string> }>) {
  return { ok: true, json: async () => ({ results: deals }), text: async () => "" };
}

// Reach the private method under test without widening the class surface.
function runClosedWon(c: AutonomousController) {
  return (c as unknown as { runClosedWonRevenueVerification: () => Promise<void> }).runClosedWonRevenueVerification();
}

beforeEach(() => {
  vi.clearAllMocks();
  existingRows = [];
  insertSpy.mockResolvedValue({ error: null });
  createClient.mockReturnValue(stableAdmin);
  process.env.HUBSPOT_ACCESS_TOKEN = "hs_token";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc_key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runClosedWonRevenueVerification", () => {
  it("captures a new closed-won deal into fee_flows", async () => {
    existingRows = []; // no existing fee_flow for this deal
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      hubspotResponse([{ id: "deal_1", properties: { amount: "1000", dealname: "Acme", closedate: "2026-06-18", pipeline: "default" } }]),
    ));

    await runClosedWon(new AutonomousController());

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const row = insertSpy.mock.calls[0][0];
    expect(row).toMatchObject({ flow_type: "closed_won", net_amount: "1000", status: "confirmed" });
    expect(row.metadata).toMatchObject({ hubspotDealId: "deal_1", dealname: "Acme" });
    expect(logAutomation).toHaveBeenCalledWith(
      "agent_closed_won_revenue_verification", "cron", "success", expect.objectContaining({ deals: 1, captured: 1 }),
    );
  });

  it("is idempotent — skips a deal already recorded in fee_flows", async () => {
    existingRows = [{ id: 99 }]; // existing fee_flow found
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      hubspotResponse([{ id: "deal_1", properties: { amount: "1000", dealname: "Acme" } }]),
    ));

    await runClosedWon(new AutonomousController());

    expect(insertSpy).not.toHaveBeenCalled();
    expect(logAutomation).toHaveBeenCalledWith(
      "agent_closed_won_revenue_verification", "cron", "success", expect.objectContaining({ captured: 0 }),
    );
  });

  it("does nothing without a HubSpot token — never calls the CRM", async () => {
    delete process.env.HUBSPOT_ACCESS_TOKEN;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await runClosedWon(new AutonomousController());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logAutomation).not.toHaveBeenCalled();
  });
});
