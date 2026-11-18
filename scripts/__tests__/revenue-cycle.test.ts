import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { phaseCheckoutLinks, phaseProposals } from "../revenue-cycle";

const CHECKOUT_BASE = "https://" + ["authichain", "com"].join(".") + "/checkout/";

interface MockDbOptions {
  leads?: Record<string, unknown>[];
  govProposals?: Record<string, unknown>[];
  updateResult?: { error: { message: string } | null };
}

function makeMockDb(opts: MockDbOptions = {}) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updateResult = opts.updateResult ?? { error: null };

  const db = {
    from: vi.fn((table: string) => {
      const rows = table === "gov_proposals" ? (opts.govProposals ?? []) : (opts.leads ?? []);
      const queryBuilder = {
        select: vi.fn(() => queryBuilder),
        in: vi.fn(() => queryBuilder),
        gte: vi.fn(() => queryBuilder),
        limit: vi.fn(async () => ({ data: rows, error: null })),
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push({ table, payload });
          return {
            eq: vi.fn(async () => updateResult),
          };
        }),
      };
      return queryBuilder;
    }),
  };

  return { db: db as unknown as SupabaseClient, updates };
}

describe("revenue-cycle checkout-links & proposals", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
  });

  it("phaseCheckoutLinks (dryRun: false) attaches canonical checkout URLs without calling fetch/Stripe or sending emails even when STRIPE_SECRET_KEY is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy_123";
    const { db, updates } = makeMockDb({
      leads: [
        {
          id: "lead-1",
          name: "Alice",
          email: "alice@example.com",
          company: "Acme Luxury Goods",
          status: "qualified",
          source: "inbound",
          metadata: { provenance: "published_contact" },
        },
      ],
    });

    const attached = await phaseCheckoutLinks(db, { dryRun: false });

    expect(attached).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    const meta = updates[0].payload.metadata as Record<string, unknown>;
    expect(typeof meta.paymentLink).toBe("string");
    expect((meta.paymentLink as string).startsWith(CHECKOUT_BASE)).toBe(true);
    expect(meta.paymentLink).toContain("prospect_id=lead-1");
    expect(meta.paymentLink).toContain("utm_source=revenue_cycle");
    expect(meta.checkoutUrl).toBe(meta.paymentLink);
  });

  it("phaseCheckoutLinks skips leads that already have paymentLink or checkoutUrl (idempotent)", async () => {
    const { db, updates } = makeMockDb({
      leads: [
        {
          id: "lead-has-payment",
          name: "Bob",
          email: "bob@example.com",
          company: "Beta Corp",
          status: "qualified",
          source: "inbound",
          metadata: { paymentLink: CHECKOUT_BASE + "existing" },
        },
        {
          id: "lead-has-checkout",
          name: "Carol",
          email: "carol@example.com",
          company: "Gamma Corp",
          status: "interested",
          source: "inbound",
          metadata: { checkoutUrl: CHECKOUT_BASE + "existing2" },
        },
      ],
    });

    const attached = await phaseCheckoutLinks(db, { dryRun: false });

    expect(attached).toBe(0);
    expect(updates).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("phaseCheckoutLinks (dryRun: true) performs zero Supabase .update() writes and zero fetch calls", async () => {
    const { db, updates } = makeMockDb({
      leads: [
        {
          id: "lead-dry",
          name: "Dana",
          email: "dana@example.com",
          company: "Delta Co",
          status: "qualified",
          source: "inbound",
          metadata: {},
        },
      ],
    });

    const attached = await phaseCheckoutLinks(db, { dryRun: true });

    expect(attached).toBe(1);
    expect(updates).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("phaseCheckoutLinks and phaseProposals do not count failed DB .update() calls when Supabase returns db_error", async () => {
    const { db: checkoutDb } = makeMockDb({
      leads: [
        {
          id: "lead-err",
          name: "Eve",
          email: "eve@example.com",
          company: "Epsilon Co",
          status: "qualified",
          source: "inbound",
          metadata: {},
        },
      ],
      updateResult: { error: { message: "db_error" } },
    });

    const attached = await phaseCheckoutLinks(checkoutDb, { dryRun: false });
    expect(attached).toBe(0);

    const { db: propDb } = makeMockDb({
      govProposals: [
        {
          notice_id: "gov-err",
          title: "Supply Chain Traceability",
          agency: "USDA",
          fit_score: 85,
          email_status: "pending",
          contact_email: "gov@agency.gov",
          payment_link: null,
        },
      ],
      leads: [
        {
          id: "lead-prop-err",
          name: "Frank",
          email: "frank@example.com",
          company: "Zeta Co",
          status: "qualified",
          source: "inbound",
          metadata: {},
        },
      ],
      updateResult: { error: { message: "db_error" } },
    });

    const planned = await phaseProposals(propDb, { dryRun: false });
    expect(planned).toBe(0);
  });

  it("phaseProposals skips gov_proposals with existing payment_link and leads with metadata.needsProposal === true", async () => {
    const { db, updates } = makeMockDb({
      govProposals: [
        {
          notice_id: "gov-skip",
          title: "Already Linked",
          agency: "DOD",
          fit_score: 90,
          email_status: "pending",
          contact_email: "skip@agency.gov",
          payment_link: CHECKOUT_BASE + "gov-existing",
        },
        {
          notice_id: "gov-new",
          title: "Needs Link",
          agency: "USDA",
          fit_score: 80,
          email_status: "pending",
          contact_email: "new@agency.gov",
          payment_link: null,
        },
      ],
      leads: [
        {
          id: "lead-skip",
          name: "Grace",
          email: "grace@example.com",
          company: "Eta Co",
          status: "qualified",
          source: "inbound",
          metadata: { needsProposal: true },
        },
        {
          id: "lead-new",
          name: "Henry",
          email: "henry@example.com",
          company: "Theta Co",
          status: "qualified",
          source: "inbound",
          metadata: {},
        },
      ],
    });

    const planned = await phaseProposals(db, { dryRun: false });

    expect(planned).toBe(2);
    expect(updates).toHaveLength(2);
    expect(updates.map((u) => u.table)).toEqual(["gov_proposals", "leads"]);
  });
});
