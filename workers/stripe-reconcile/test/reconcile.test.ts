import { describe, it, expect, vi, afterEach } from "vitest";
import { reconcile } from "../src/reconcile";
import { run, isDryRun, assertRestrictedRole, toRow } from "../src/index";
import type { ReconInput, StripeCharge } from "../src/types";
import tenDollar from "./fixtures/ten-dollar-no-ledger.json";
import allowlistFile from "../../../ops/reconcile/excluded-test-payments.json";

const base = (o: Partial<ReconInput> = {}): ReconInput => ({
  windowStart: "2026-10-22T00:00:00.000Z", windowEnd: "2026-10-24T00:00:00.000Z",
  charges: [], sessions: [], payouts: [], ledger: [], events: [], allowlist: [], ...o,
});
const ch = (id: string, o: Partial<StripeCharge> = {}): StripeCharge => ({
  id: `ch_${id}`, payment_intent: `pi_${id}`, amount: 2500, amount_refunded: 0, currency: "usd",
  status: "succeeded", refunded: false, livemode: true, ...o,
});
const sess = (id: string) => ({ id: `cs_${id}`, payment_intent: `pi_${id}`, livemode: true, status: "complete" });
const classes = (i: ReconInput) => reconcile(i).mismatches.map((m) => m.class);

describe("mismatch classes", () => {
  it("fixture: $10 charge with no ledger row -> MISSING_IN_LEDGER", () => {
    const s = reconcile(tenDollar as ReconInput);
    expect(s.mismatches).toEqual([{ class: "MISSING_IN_LEDGER", id: "ch_fixture_ten_dollar" }]);
    expect(s.stripe_charge_sum_cents).toBe(1000);
    expect(s.status).toBe("mismatch");
  });
  it("MISSING_IN_STRIPE", () => {
    expect(classes(base({ ledger: [{ session_id: "cs_ghost", amount_cents: 500, currency: "usd", status: "paid" }] })))
      .toEqual(["MISSING_IN_STRIPE"]);
  });
  it("AMOUNT_MISMATCH", () => {
    expect(classes(base({ charges: [ch("a")], sessions: [sess("a")],
      ledger: [{ session_id: "cs_a", amount_cents: 2000, currency: "usd", status: "paid" }] }))).toEqual(["AMOUNT_MISMATCH"]);
  });
  it("STATUS_MISMATCH (refunded in Stripe, paid in ledger)", () => {
    expect(classes(base({ charges: [ch("b", { refunded: true, amount_refunded: 2500 })], sessions: [sess("b")],
      ledger: [{ session_id: "cs_b", amount_cents: 2500, currency: "usd", status: "paid" }] }))).toEqual(["STATUS_MISMATCH"]);
  });
  it("WEBHOOK_ERROR", () => {
    expect(reconcile(base({ events: [{ event_id: "evt_1", event_type: "checkout.session.expired", status: "error" },
      { event_id: "evt_2", event_type: "checkout.session.completed", status: "success" }] })).mismatches)
      .toEqual([{ class: "WEBHOOK_ERROR", id: "evt_1" }]);
  });
  it("PAYOUT_DRIFT", () => {
    expect(classes(base({ payouts: [{ id: "po_1", amount: 931, livemode: true, balance_txn_sum: 900 },
      { id: "po_2", amount: 931, livemode: true, balance_txn_sum: 931 }] }))).toEqual(["PAYOUT_DRIFT"]);
  });
  it("clean match -> ok", () => {
    const s = reconcile(base({ charges: [ch("c")], sessions: [sess("c")],
      ledger: [{ session_id: "cs_c", amount_cents: 2500, currency: "usd", status: "paid" }] }));
    expect(s.status).toBe("ok");
  });
});

describe("exclusions", () => {
  it("allowlisted $10 Zac test -> excluded_test_count=1, revenue $0", () => {
    const s = reconcile(base({ charges: [ch("x", { id: "ch_3UHcQfGqTruSqV8T1j4hdD7l",
      payment_intent: "pi_3UHcQfGqTruSqV8T18dYFwd3", amount: 1000 })], allowlist: allowlistFile.ids }));
    expect(s.excluded_test_count).toBe(1);
    expect(s.customer_revenue_cents).toBe(0);
    expect(s.mismatch_count).toBe(0);
  });
  it("allowlist is marked PENDING ZAC CONFIRMATION", () => {
    expect(allowlistFile.status).toBe("PENDING ZAC CONFIRMATION");
  });
  it("ignores livemode=false and metadata test_payment=owner", () => {
    const s = reconcile(base({ charges: [ch("t", { livemode: false }), ch("o", { metadata: { test_payment: "owner" } })] }));
    expect(s.mismatch_count).toBe(0);
    expect(s.excluded_test_count).toBe(1);
  });
});

describe("no PII in mismatches", () => {
  it("each mismatch has only class and id", () => {
    const s = reconcile(base({ charges: [ch("p")], events: [{ event_id: "evt_9", event_type: "x", status: "error" }] }));
    for (const m of s.mismatches) expect(Object.keys(m).sort()).toEqual(["class", "id"]);
    expect(JSON.stringify(toRow(s))).not.toMatch(/@|email|name|card/i);
  });
});

describe("dry run + role guard", () => {
  afterEach(() => vi.unstubAllGlobals());
  const jwt = (role: string) => `h.${btoa(JSON.stringify({ role }))}.s`;
  const env = (o = {}) => ({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-placeholder",
    STRIPE_RECON_RESTRICTED_KEY: "r" + "k_live_placeholder", RECON_DB_JWT: jwt("stripe_reconciler"), ...o });
  const mockFetch = () => vi.fn(async (_u: string, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === "POST" ? {} : String(_u).includes("stripe.com") ? { data: [], has_more: false } : []),
      { status: 200 }));

  it("DRY_RUN defaults on", () => { expect(isDryRun({})).toBe(true); expect(isDryRun({ DRY_RUN: "false" })).toBe(false); });
  it("dry run makes no POST", async () => {
    const f = mockFetch(); vi.stubGlobal("fetch", f); vi.spyOn(console, "log").mockImplementation(() => {});
    await run(env() as any, new Date("2026-10-24T10:00:00Z"));
    expect(f.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "POST")).toBe(false);
  });
  it("DRY_RUN=false writes exactly one reconciliation_runs row", async () => {
    const f = mockFetch(); vi.stubGlobal("fetch", f); vi.spyOn(console, "log").mockImplementation(() => {});
    await run(env({ DRY_RUN: "false" }) as any, new Date("2026-10-24T10:00:00Z"));
    const posts = f.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === "POST");
    expect(posts.length).toBe(1);
    expect(String(posts[0][0])).toMatch(/\/rest\/v1\/reconciliation_runs$/);
  });
  it("FULL_HISTORY=true on a non-Sunday dry run sees Sep 20 allowlisted $10 -> excluded=1, $0, no POST", async () => {
    const urls: string[] = [];
    const f = vi.fn(async (u: string, init?: RequestInit) => {
      urls.push(String(u));
      const url = String(u);
      if (url.includes("stripe.com/v1/charges")) {
        const gte = Number(new URL(url).searchParams.get("created[gte]"));
        const sep20 = Date.parse("2026-09-20T04:32:00Z") / 1000;
        const data = gte <= sep20 ? [{ id: "ch_3UHcQfGqTruSqV8T1j4hdD7l", payment_intent: "pi_3UHcQfGqTruSqV8T18dYFwd3",
          amount: 1000, amount_refunded: 0, currency: "usd", status: "succeeded", refunded: false, livemode: true,
          created: sep20, metadata: {} }] : [];
        return new Response(JSON.stringify({ data, has_more: false }));
      }
      if (url.includes("stripe.com")) return new Response(JSON.stringify({ data: [], has_more: false }));
      return new Response(JSON.stringify(init?.method === "POST" ? {} : []));
    });
    vi.stubGlobal("fetch", f); vi.spyOn(console, "log").mockImplementation(() => {});
    const sat = new Date("2026-10-24T10:00:00Z"); // Saturday
    expect(sat.getUTCDay()).not.toBe(0);
    const s = await run(env({ FULL_HISTORY: "true" }) as any, sat);
    expect(s.window_start).toBe(new Date(0).toISOString());
    expect(s.excluded_test_count).toBe(1);
    expect(s.customer_revenue_cents).toBe(0);
    expect(s.mismatch_count).toBe(0);
    expect(f.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "POST")).toBe(false);
  });
  it("FULL_HISTORY default off: non-Sunday run uses 48h window and misses Sep 20", async () => {
    vi.stubGlobal("fetch", mockFetch()); vi.spyOn(console, "log").mockImplementation(() => {});
    const s = await run(env() as any, new Date("2026-10-24T10:00:00Z"));
    expect(s.window_start).toBe("2026-10-22T10:00:00.000Z");
    expect(s.excluded_test_count).toBe(0);
  });
  it("refuses service_role JWT", () => {
    expect(() => assertRestrictedRole(jwt("service_role"))).toThrow();
  });
});
