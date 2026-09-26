/**
 * Terminal-escalation path for the autonomous DPP revenue loop.
 *
 * A paid session whose profile upsert fails must throw (so Stripe retries the
 * delivery) WITHOUT writing `dpp_loop:provisioned` — session-id dedupe would
 * otherwise hide a later successful retry. Retries must not duplicate
 * `payment_succeeded` (recordDppLoopEventOnce dedupe_key). Once the paid
 * stage sits past its retry budget (STALL_THRESHOLDS_MS.payment_succeeded),
 * runDppExceptionsReport surfaces the visit as a founder exception, from
 * which the founder alert is built.
 *
 * No live sends, no secrets — fetch is stubbed, Supabase is in-memory.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DPP_OFFER_KEY } from "./plans";
import { fulfillDppPaidSession } from "./dpp-fulfill-checkout";
import { STALL_THRESHOLDS_MS, runDppExceptionsReport } from "./dpp-loop";
import { NTFY_URL, publishFounderAlert } from "./founder-alerts";

vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./billing-emails", () => ({
  renderBillingEmail: vi.fn().mockReturnValue({
    from: "billing@authichain.com",
    subject: "provisioned",
    html: "<p>ok</p>",
    text: "ok",
  }),
}));

// In-memory Supabase stand-in: profiles insert always fails (forces the
// upsert_failed branch in provisionPurchase), funnel_events accumulates loop
// rows for the exceptions report.
function fakeTerminalSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Array<Record<string, any>> = [];
  const insertError = {
    message:
      'null value in column "user_id" of relation "profiles" violates not-null constraint',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function builderFor(table: string): any {
    const filters: Array<[string, unknown]> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      like: () => builder,
      order: () => builder,
      range: async () => ({ data: [...rows], error: null }),
      limit: async () => ({
        data: rows.filter(r => filters.every(([c, v]) => r[c] === v)),
        error: null,
      }),
      maybeSingle: async () => {
        if (table === "profiles") return { data: null, error: null };
        const found =
          rows.find(r => filters.every(([c, v]) => r[c] === v)) ?? null;
        return { data: found, error: null };
      },
      update: () => builder,
      insert: (row: Record<string, unknown>) => {
        if (table === "funnel_events") {
          rows.push(row);
          return Promise.resolve({ error: null });
        }
        // profiles guest insert: always fails for this scenario.
        return {
          select: () => ({
            maybeSingle: async () => ({ data: null, error: insertError }),
          }),
        };
      },
      then: (
        resolve: (v: { error: null }) => unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject?: (e: any) => unknown
      ) => Promise.resolve({ error: null }).then(resolve, reject),
    };
    return builder;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: { from: (t: string): any => builderFor(t) }, rows };
}

const VISIT = "term_esc_1";
const SESSION = "cs_term_esc_1";

function paidSession() {
  return {
    id: SESSION,
    amount_total: 29900,
    customer_details: { email: "buyer@example.com" },
    client_reference_id: VISIT,
    metadata: {
      offer: DPP_OFFER_KEY,
      plan: "dpp_readiness",
      visit_id: VISIT,
      source: "direct",
    },
  };
}

describe("DPP terminal escalation (upsert_failed → retry budget → exception)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws for Stripe retry without writing provisioned; retries dedupe; exception after budget", async () => {
    const { supabase, rows } = fakeTerminalSupabase();

    // First delivery: provision fails → throw so Stripe retries.
    await expect(
      fulfillDppPaidSession(supabase, paidSession())
    ).rejects.toThrow(/DPP provision failed/);
    expect(rows.map(r => r.event_type)).toEqual(["dpp_loop:payment_succeeded"]);

    // Stripe retry: still failing, and payment_succeeded is NOT duplicated —
    // recordDppLoopEventOnce dedupe_key (session id) holds.
    await expect(
      fulfillDppPaidSession(supabase, paidSession())
    ).rejects.toThrow(/DPP provision failed/);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:payment_succeeded")
    ).toHaveLength(1);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:provisioned")
    ).toHaveLength(0);

    // Inside the retry budget the visit is in-flight, not an exception.
    const RETRY_BUDGET_MS = STALL_THRESHOLDS_MS.payment_succeeded;
    expect(RETRY_BUDGET_MS).toBe(2 * 3_600_000);
    const inFlight = await runDppExceptionsReport(
      supabase,
      new Date(Date.now() + 30 * 60_000)
    );
    expect(inFlight.exceptionCount).toBe(0);

    // Past the budget: the paid stall is a founder exception record.
    const terminal = await runDppExceptionsReport(
      supabase,
      new Date(Date.now() + (RETRY_BUDGET_MS ?? 0) + 60_000)
    );
    expect(terminal.exceptionCount).toBe(1);
    expect(terminal.exceptions[0]).toMatchObject({
      visitId: VISIT,
      furthest: "payment_succeeded",
    });
    expect(terminal.exceptions[0].stall).toMatchObject({
      kind: "exception",
      nextExpected: "provisioned",
      reason: "threshold_exceeded",
    });
  });

  it("builds the founder alert from the terminal exception (no live send)", async () => {
    const { supabase } = fakeTerminalSupabase();
    await expect(
      fulfillDppPaidSession(supabase, paidSession())
    ).rejects.toThrow(/DPP provision failed/);
    const report = await runDppExceptionsReport(
      supabase,
      new Date(Date.now() + 3 * 3_600_000)
    );
    expect(report.exceptionCount).toBe(1);
    const exc = report.exceptions[0];

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await publishFounderAlert({
      title: `DPP exception: ${exc.visitId} stalled at ${exc.furthest}`,
      text: `visit ${exc.visitId} paid but never ${exc.stall.nextExpected} (${exc.stall.reason}, ${exc.stall.hours?.toFixed(1)}h)`,
      subject: `DPP exception: ${exc.visitId}`,
      kind: "draft",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NTFY_URL);
    expect(String(init.body)).toContain(VISIT);
    expect(String(init.body)).toContain("provisioned");
  });
});
