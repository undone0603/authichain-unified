import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveSegment,
  hasVerifiedProvenance,
  paymentCtaForLead,
  phaseCheckoutLinks,
  phaseProposals,
  phaseReport,
  segmentPaymentCta,
} from "../revenue-cycle";

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


  it("phaseReport selects only production columns and reports query errors instead of zeros", async () => {
    const selects: Record<string, string> = {};
    const missing: Record<string, string> = {
      gov_proposals: "payment_link",
      revenue_records: "created_at",
    };
    const db = {
      from: vi.fn((table: string) => {
        let cols = "";
        const q: Record<string, unknown> = {};
        q.select = vi.fn((c: string) => {
          cols = c;
          selects[table] = c;
          return q;
        });
        for (const name of ["order", "limit", "eq", "in", "gte", "or", "not"]) {
          q[name] = vi.fn(() => q);
        }
        q.then = (resolve: (v: unknown) => unknown) => {
          // Mimic PostgREST: an unknown column is an error, not an exception.
          const bad = missing[table] && cols.split(",").includes(missing[table]);
          const result = bad
            ? { data: null, error: { message: `column ${table}.${missing[table]} does not exist` } }
            : { data: [], error: null };
          return Promise.resolve(result).then(resolve);
        };
        return q;
      }),
    } as unknown as SupabaseClient;

    const lines = await phaseReport(db);

    expect(selects.gov_proposals.split(",")).not.toContain("payment_link");
    expect(selects.revenue_records.split(",")).not.toContain("created_at");
    expect(lines.join("\n")).toContain("Gov proposals sampled: 0 (unsent=0)");
    expect(lines.join("\n")).toContain("revenue_records (last ≤100): count=0");
  });

  it("phaseReport surfaces a Supabase error rather than printing an empty sample", async () => {
    const db = {
      from: vi.fn(() => {
        const q: Record<string, unknown> = {};
        for (const name of ["select", "order", "limit", "eq", "in", "gte", "or", "not"]) {
          q[name] = vi.fn(() => q);
        }
        q.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: { message: "permission denied" } }).then(resolve);
        return q;
      }),
    } as unknown as SupabaseClient;

    const out = (await phaseReport(db)).join("\n");

    expect(out).toContain("Gov proposals: failed (permission denied)");
    expect(out).toContain("revenue_records: failed (permission denied)");
    expect(out).not.toContain("Gov proposals sampled");
  });

  it("derives the product from the lead source when segment is empty", () => {
    const qron = { segment: null, source: "b2b_outreach_qron", metadata: {} };
    expect(effectiveSegment(qron)).toBe("qron");
    expect(paymentCtaForLead(qron)?.name).toBe(segmentPaymentCta("qron")?.name);
    expect(paymentCtaForLead(qron)?.name).not.toBe(segmentPaymentCta(null)?.name);

    expect(effectiveSegment({ segment: null, source: "b2b_outreach_strainchain" })).toBe("strainchain");
    expect(effectiveSegment({ segment: null, source: "x", metadata: { target: { segment: "qron" } } })).toBe("qron");
    expect(effectiveSegment({ segment: "gov", source: "b2b_outreach_qron" })).toBe("gov");
    expect(effectiveSegment({ segment: null, source: "website_form" })).toBeNull();
  });

  it("never attaches a self-serve checkout to a channel partner", () => {
    expect(paymentCtaForLead({ segment: "strainchain", source: "channel_partner_web_scan_2026-09-19" })).toBeNull();
    expect(
      paymentCtaForLead({ segment: null, source: "x", metadata: { target: { role: "channel_partner" } } })
    ).toBeNull();
  });

  it("phaseCheckoutLinks gives a QRON print prospect the QRON product and skips channel partners", async () => {
    const { db, updates } = makeMockDb({
      leads: [
        {
          id: 349,
          email: "franchiseinfo@example-signs.com",
          status: "contacted",
          segment: null,
          source: "b2b_outreach_qron",
          metadata: { source: "published_contact", target: { source: "published_contact" } },
        },
        {
          id: 478,
          email: "info@example-consulting.com",
          status: "contacted",
          segment: null,
          source: "channel_partner_web_scan_2026-09-19",
          metadata: { source: "published_contact", target: { role: "channel_partner" } },
        },
      ],
    });
    const planned = await phaseCheckoutLinks(db, { dryRun: false });
    expect(planned).toBe(1);
    expect(updates).toHaveLength(1);
    const meta = updates[0].payload.metadata as Record<string, unknown>;
    expect(meta.paymentProduct).toBe(segmentPaymentCta("qron")?.name);
  });

  it("does not treat a stamped inbound_optin on a cold-outreach lead as an opt-in", () => {
    const cold = {
      source: "b2b_outreach_strainchain",
      emailReplied: false,
      repliesReceived: 0,
      metadata: { source: "inbound_optin", target: { source: "unknown" } },
    };
    expect(hasVerifiedProvenance(cold)).toBe(false);
    for (const col of ["b2b_outreach_qron", "scraped", "pattern_guess", "unknown", "seed"]) {
      expect(hasVerifiedProvenance({ ...cold, source: col })).toBe(false);
    }
    // A real reply is still trusted.
    expect(hasVerifiedProvenance({ ...cold, emailReplied: true })).toBe(true);
    // A genuine inbound column keeps its opt-in.
    expect(hasVerifiedProvenance({ ...cold, source: "website_form" })).toBe(true);
    // Other verification stamps on cold rows are unchanged.
    expect(
      hasVerifiedProvenance({ ...cold, metadata: { source: "published_contact" } })
    ).toBe(true);
    expect(
      hasVerifiedProvenance({ ...cold, metadata: { verification_source: "apollo_verified" } })
    ).toBe(true);
  });

  it("phaseCheckoutLinks skips a cold-outreach lead that only carries a stamped inbound_optin", async () => {
    const { db, updates } = makeMockDb({
      leads: [
        {
          id: 14,
          email: "compliance@example-mso.com",
          status: "contacted",
          segment: null,
          source: "b2b_outreach_strainchain",
          emailReplied: false,
          repliesReceived: 0,
          metadata: { source: "inbound_optin", target: { source: "unknown" } },
        },
      ],
    });
    const planned = await phaseCheckoutLinks(db, { dryRun: false });
    expect(planned).toBe(0);
    expect(updates).toHaveLength(0);
  });
});

