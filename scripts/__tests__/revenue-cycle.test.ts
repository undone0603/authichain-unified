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
      const source = table === "gov_proposals" ? (opts.govProposals ?? []) : (opts.leads ?? []);
      // Only `.is(col, null)` and `.limit(n)` are modelled: together they decide which
      // rows a capped query can see. Other filters are accepted and ignored so
      // fixtures stay small.
      const nullCols: string[] = [];
      let max = Number.POSITIVE_INFINITY;
      const queryBuilder: Record<string, unknown> = {};
      const chain = () => queryBuilder;
      for (const name of ["select", "in", "gte", "eq", "neq", "not", "or", "order"]) {
        queryBuilder[name] = vi.fn(chain);
      }
      queryBuilder.is = vi.fn((col: string, val: unknown) => {
        if (val === null) nullCols.push(col);
        return queryBuilder;
      });
      queryBuilder.limit = vi.fn((n: number) => {
        max = n;
        return queryBuilder;
      });
      queryBuilder.then = (
        resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown
      ) => {
        const rows = source.filter(r => nullCols.every(c => r[c] == null)).slice(0, max);
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      };
      queryBuilder.update = vi.fn((payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return { eq: vi.fn(async () => updateResult) };
      });
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
    // The phase writes `paymentLink` only; `checkoutUrl` is just an alternate key that
    // the idempotency check also honours.
    expect(typeof meta.paymentLinkAttachedAt).toBe("string");
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

  it("avoids gov_proposals fields absent from production", async () => {
    const { db, updates } = makeMockDb({
      govProposals: [
        {
          notice_id: "gov-real-schema",
          title: "Asset provenance",
          agency: "Public Agency",
          fit_score: 85,
          email_status: "unsent",
          contact_email: "published@agency.gov",
        },
      ],
      leads: [
        {
          id: "lead-eligible",
          email: "inbound@example.com",
          status: "qualified",
          metadata: {},
        },
      ],
    });

    const planned = await phaseProposals(db, { dryRun: false });

    expect(planned).toBe(1);
    expect(db.from).not.toHaveBeenCalledWith("gov_proposals");
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("leads");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not let flagged leads consume proposal slots", async () => {
    const flagged = Array.from({ length: 30 }, (_, i) => ({
      id: "lead-done-" + i,
      email: "done" + i + "@example.com",
      status: "qualified",
      proposalsSent: 0,
      metadata: { needsProposal: true },
    }));
    const eligible = {
      id: "lead-next",
      email: "ready@example.com",
      status: "qualified",
      proposalsSent: 0,
      metadata: {},
    };
    const { db, updates } = makeMockDb({ leads: [...flagged, eligible] });

    const planned = await phaseProposals(db, { dryRun: false });

    expect(planned).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("leads");
    const metadata = updates[0].payload.metadata as Record<string, unknown>;
    expect(metadata.needsProposal).toBe(true);
  });

});
