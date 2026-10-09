import { beforeEach, describe, expect, it, vi } from "vitest";
import { DPP_OFFER_KEY } from "./plans";
import { DPP_PRICE_ID } from "./dpp-loop";

vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true, provider: "resend", status: 200 }),
}));
vi.mock("./billing-emails", () => ({
  renderBillingEmail: vi.fn().mockReturnValue({
    from: "billing@authichain.com",
    subject: "provisioned",
    html: "<p>ok</p>",
    text: "ok",
  }),
}));

const { sendEmail } = await import("./email");
const { fulfillDppPaidSession, redactForLog } = await import("./dpp-fulfill-checkout");
const { stageOf } = await import("./dpp-loop");

function fakeSupabase(opts?: {
  profileId?: string | null;
  existingProfile?: boolean;
  insertError?: { message: string } | null;
}) {
  const rows: Array<Record<string, unknown>> = [];
  const profileId = opts?.profileId === undefined ? "prof_1" : opts.profileId;
  const existingProfile = opts?.existingProfile ?? profileId != null;
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const builder: Record<string, unknown> = {
      insert: (row: Record<string, unknown>) => {
        if (table === "funnel_events") {
          rows.push(row);
          return Promise.resolve({ error: null });
        }
        if (table === "profiles") {
          const result = opts?.insertError
            ? { data: null, error: opts.insertError }
            : { data: profileId ? { id: profileId } : null, error: null };
          return {
            select: () => ({
              maybeSingle: async () => result,
            }),
          };
        }
        return Promise.resolve({ error: null });
      },
      update: () => builder,
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      maybeSingle: async () => {
        if (table === "profiles") {
          return {
            data: existingProfile && profileId ? { id: profileId } : null,
            error: null,
          };
        }
        return { data: null, error: null };
      },
      limit: async () => ({
        data: rows.filter(r => filters.every(([c, v]) => r[c] === v)),
        error: null,
      }),
    };
    return builder;
  };
  return { supabase: { from }, rows };
}

const paidSession = {
  id: "cs_live_smoke_check",
  amount_total: 0,
  customer_details: { email: "buyer@example.com" },
  client_reference_id: "smoke_check_1",
  metadata: {
    offer: DPP_OFFER_KEY,
    plan: "dpp_readiness",
    visit_id: "smoke_check_1",
    source: "direct",
  },
};

describe("fulfillDppPaidSession", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
  });

  it("records a failed status and logs no address when the provider rejects the send", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({
      ok: false,
      provider: "resend",
      status: 422,
      error: "Invalid `to` field: buyer@example.com",
    } as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    const logged = errSpy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
    errSpy.mockRestore();

    expect(result).toEqual({ handled: true, profileId: "prof_1", activationEmail: "failed" });
    expect(logged).toContain("[dpp-fulfill] activation email failed");
    expect(logged).toContain("session=cs_live_smoke_check");
    expect(logged).toContain("status=422");
    expect(logged).not.toContain("buyer@example.com");
    expect(logged).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);

    const failed = rows.filter(r => r.event_type === "dpp_activation_email:failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ prospect_id: "smoke_check_1", stage: "complete_checkout" });
    expect(failed[0].metadata).toMatchObject({
      activation_email_status: "failed",
      stripe_session_id: "cs_live_smoke_check",
      profile_id: "prof_1",
      provider: "resend",
      http_status: 422,
    });
    expect(JSON.stringify(failed[0])).not.toContain("buyer@example.com");
    // Not a loop event: loop reconstruction and stall reports are unchanged.
    expect(stageOf(failed[0] as never)).toBeNull();
  });

  it("records a failed status when the send throws instead of swallowing it", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("connect ETIMEDOUT for buyer@example.com"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    const logged = errSpy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
    errSpy.mockRestore();

    expect(result.activationEmail).toBe("failed");
    expect(logged).toContain("ETIMEDOUT");
    expect(logged).not.toContain("buyer@example.com");
    expect(rows.filter(r => r.event_type === "dpp_activation_email:failed")).toHaveLength(1);
  });

  it("writes no failure row when the send succeeds", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    expect(result.activationEmail).toBe("sent");
    expect(rows.some(r => r.event_type === "dpp_activation_email:failed")).toBe(false);
  });

  it("redactForLog strips addresses and caps length", () => {
    expect(redactForLog("bad to: a.b+c@sub.example.co.uk, retry")).toBe("bad to: [redacted], retry");
    expect(redactForLog(undefined)).toBe("unknown");
    expect(redactForLog("x".repeat(500))).toHaveLength(200);
  });

  it("no-ops when the session is not a DPP offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_other",
      metadata: { plan: "starter" },
    });
    expect(result).toEqual({ handled: false, profileId: null, activationEmail: "skipped" });
    expect(rows).toHaveLength(0);
  });

  it("treats the catalog price id as a DPP offer without metadata.offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(
      supabase,
      {
        id: "cs_price_only",
        customer_details: { email: "buyer@example.com" },
        client_reference_id: "plink_visit",
        metadata: {},
      },
      DPP_PRICE_ID
    );
    expect(result.handled).toBe(true);
    expect(result.profileId).toBe("prof_1");
    expect(
      rows.map(r => (r.metadata as { loop_stage?: string }).loop_stage)
    ).toEqual(["payment_succeeded", "provisioned"]);
  });

  it("does not skip $0 DPP-SMOKE sessions (is_demo + smoke_* visit id)", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_live_a1y4TuVXsdPVbXgPejLnXYpSWD5RvpmO273RUC3BxOHnAZ5JwlARbBMxQS",
      amount_total: 0,
      customer_details: { email: "authichain@gmail.com" },
      client_reference_id: "smoke_check_1789786486",
      metadata: {
        offer: DPP_OFFER_KEY,
        plan: "dpp_readiness",
        visit_id: "smoke_check_1789786486",
        prospect_id: "smoke_check_1789786486",
        is_demo: "true",
        promo: "DPP-SMOKE-E2E",
        source: "direct",
      },
    });
    expect(result.handled).toBe(true);
    expect(result.profileId).toBe("prof_1");
    expect(rows.map(r => r.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(rows[0].prospect_id).toBe("smoke_check_1789786486");
    expect((rows[0].metadata as { is_demo?: boolean }).is_demo).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the provisioned email for a non-demo paid session", async () => {
    const { supabase } = fakeSupabase();
    await fulfillDppPaidSession(supabase, paidSession);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("writes payment_succeeded before provision on a $0 promo session", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    expect(result).toEqual({ handled: true, profileId: "prof_1", activationEmail: "sent" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      prospect_id: "smoke_check_1",
      event_type: "dpp_loop:payment_succeeded",
    });
    expect(rows[1]).toMatchObject({
      prospect_id: "smoke_check_1",
      event_type: "dpp_loop:provisioned",
    });
  });

  it("writes provisioned with skip_reason when there is no buyer identity", async () => {
    const { supabase, rows } = fakeSupabase({ profileId: null });
    const result = await fulfillDppPaidSession(supabase, {
      ...paidSession,
      customer_details: null,
      customer_email: null,
      metadata: { ...paidSession.metadata, user_id: undefined },
    });
    expect(result).toEqual({ handled: true, profileId: null, activationEmail: "skipped" });
    expect(rows.map(r => r.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(rows[1].metadata).toMatchObject({
      loop_stage: "provisioned",
      skip_reason: "no_identity",
    });
  });

  it("throws on guest profile insert failure so Stripe retries; does not write provisioned", async () => {
    const { supabase, rows } = fakeSupabase({
      profileId: null,
      existingProfile: false,
      insertError: {
        message:
          'null value in column "user_id" of relation "profiles" violates not-null constraint',
      },
    });
    await expect(
      fulfillDppPaidSession(supabase, {
        id: "cs_live_a1y4Tu_user_id",
        amount_total: 0,
        customer_details: { email: "authichain@gmail.com" },
        client_reference_id: "smoke_check_1789786486",
        metadata: {
          offer: DPP_OFFER_KEY,
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
          is_demo: "true",
          promo: "DPP-SMOKE-E2E",
        },
      })
    ).rejects.toThrow(/user_id/i);
    expect(rows.map(r => r.event_type)).toEqual(["dpp_loop:payment_succeeded"]);
  });

  it("provisions a guest smoke buyer when profiles insert succeeds without user_id", async () => {
    const { supabase, rows } = fakeSupabase({
      profileId: "prof_guest",
      existingProfile: false,
    });
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_live_a1y4Tu_guest",
      amount_total: 0,
      customer_details: { email: "authichain@gmail.com" },
      client_reference_id: "smoke_check_1789786486",
      metadata: {
        offer: DPP_OFFER_KEY,
        plan: "dpp_readiness",
        visit_id: "smoke_check_1789786486",
        is_demo: "true",
        promo: "DPP-SMOKE-E2E",
      },
    });
    expect(result).toEqual({ handled: true, profileId: "prof_guest", activationEmail: "skipped" });
    expect(rows.map(r => r.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(
      (rows[1].metadata as { skip_reason?: string }).skip_reason
    ).toBeUndefined();
    expect((rows[1].metadata as { profile_id?: string }).profile_id).toBe(
      "prof_guest"
    );
  });

  it("does not double-count payment or provision on webhook replay", async () => {
    const { supabase, rows } = fakeSupabase();
    await fulfillDppPaidSession(supabase, paidSession);
    await fulfillDppPaidSession(supabase, paidSession);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:payment_succeeded")
    ).toHaveLength(1);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:provisioned")
    ).toHaveLength(1);
  });
});
