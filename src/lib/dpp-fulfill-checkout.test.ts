import { beforeEach, describe, expect, it, vi } from "vitest";
import { DPP_OFFER_KEY } from "./plans";
import { DPP_PRICE_ID } from "./dpp-loop";

vi.mock("./email", () => ({
  sendEmail: vi
    .fn()
    .mockResolvedValue({ ok: true, provider: "resend", status: 200 }),
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
const { fulfillDppPaidSession, redactForLog } =
  await import("./dpp-fulfill-checkout");
const { stageOf } = await import("./dpp-loop");

function fakeSupabase(opts?: {
  profileId?: string | null;
  existingProfile?: boolean;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  failContinuityUpdateOnce?: boolean;
  failProvisionedEventOnce?: boolean;
  preGrantedSessionId?: string;
}) {
  const rows: Array<Record<string, unknown>> = [];
  const profileUpdates: Array<Record<string, unknown>> = [];
  const profileId = opts?.profileId === undefined ? "prof_1" : opts.profileId;
  const existingProfile = opts?.existingProfile ?? profileId != null;
  const profile: Record<string, unknown> | null =
    existingProfile && profileId
      ? {
          id: profileId,
          ...(opts?.preGrantedSessionId
            ? {
                last_grant_session_id: opts.preGrantedSessionId,
                generations_limit: 100,
                generations_used: 20,
              }
            : {}),
        }
      : null;
  const continuity = new Map<string, Record<string, unknown>[]>();
  const grantedSessions = new Set<string>();
  let continuityUpdateFailed = false;
  let provisionedEventFailed = false;
  const from = (table: string) => {
    if (
      table === "founder_exit_actions" ||
      table === "founder_exit_side_effects"
    ) {
      const bucket = continuity.get(table) ?? [];
      continuity.set(table, bucket);
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return builder;
        },
        maybeSingle: async () => {
          const found =
            bucket.find(row =>
              filters.every(([col, val]) => row[col] === val)
            ) ?? null;
          return { data: found, error: null };
        },
        insert: async (row: Record<string, unknown>) => {
          if (
            bucket.some(
              existing => existing.idempotency_key === row.idempotency_key
            )
          ) {
            return { error: { code: "23505" } };
          }
          bucket.push({ ...row });
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            if (
              table === "founder_exit_actions" &&
              opts?.failContinuityUpdateOnce &&
              !continuityUpdateFailed
            ) {
              continuityUpdateFailed = true;
              return {
                error: { message: "injected continuity update failure" },
              };
            }
            const found = bucket.find(row => row[col] === val);
            if (found) Object.assign(found, patch);
            return { error: null };
          },
        }),
      };
      return builder;
    }
    const filters: Array<[string, unknown]> = [];
    const builder: Record<string, unknown> = {
      insert: (row: Record<string, unknown>) => {
        if (table === "funnel_events") {
          if (
            row.event_type === "dpp_loop:provisioned" &&
            opts?.failProvisionedEventOnce &&
            !provisionedEventFailed
          ) {
            provisionedEventFailed = true;
            return Promise.resolve({
              error: { message: "injected provisioned event failure" },
            });
          }
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
      update: (patch: Record<string, unknown>) => {
        const result = opts?.updateError
          ? { error: opts.updateError }
          : { error: null };
        if (table === "profiles" && profile && !opts?.updateError) {
          Object.assign(profile, patch);
          profileUpdates.push(patch);
        }
        // provisioning.ts writes the entitlement as a compare-and-set update
        // (ef4d083e, CFA-346): update().eq("id").is()/eq()...select("id").
        // The chain must stay awaitable at every step, and the conditional
        // form must report one matched row, or provisioning treats it as a
        // concurrent-update conflict.
        const settled = opts?.updateError
          ? { ...result, data: null }
          : { ...result, data: [{ id: profileId }] };
        const chain: {
          eq: () => typeof chain;
          is: () => typeof chain;
          select: () => typeof chain;
          then: Promise<typeof settled>["then"];
        } = {
          eq: () => chain,
          is: () => chain,
          select: () => chain,
          then: (onFulfilled, onRejected) =>
            Promise.resolve(settled).then(onFulfilled, onRejected),
        };
        return chain;
      },
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      maybeSingle: async () => {
        if (table === "profiles") {
          if (
            filters.some(([col]) => col === "last_grant_session_id") &&
            !filters.every(([col, val]) => profile?.[col] === val)
          ) {
            return { data: null, error: null };
          }
          return {
            data: profile,
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
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn !== "grant_dpp_checkout_session") {
      return { data: null, error: { message: "unexpected RPC" } };
    }
    if (opts?.updateError) {
      return { data: null, error: opts.updateError };
    }
    const sessionId = String(args.p_session_id);
    const effects = continuity.get("founder_exit_side_effects") ?? [];
    continuity.set("founder_exit_side_effects", effects);
    if (grantedSessions.has(sessionId)) {
      return {
        data: { status: "already_granted", profile_id: args.p_profile_id },
        error: null,
      };
    }
    grantedSessions.add(sessionId);
    if (profile?.last_grant_session_id === sessionId) {
      effects.push({
        idempotency_key: `grant:${sessionId}`,
        profile_id: String(args.p_profile_id),
      });
      return {
        data: { status: "already_granted", profile_id: args.p_profile_id },
        error: null,
      };
    }
    const limit = Number(profile?.generations_limit ?? 0);
    const used = Number(profile?.generations_used ?? 0);
    const patch = {
      brand: args.p_brand,
      generations_limit:
        limit >= 999999 ? limit : Math.max(0, limit - used) + 50,
      generations_used: limit >= 999999 ? used : 0,
      last_grant_session_id: sessionId,
    };
    if (profile) Object.assign(profile, patch);
    profileUpdates.push(patch);
    effects.push({
      idempotency_key: `grant:${sessionId}`,
      profile_id: String(args.p_profile_id),
    });
    return {
      data: { status: "granted", profile_id: args.p_profile_id },
      error: null,
    };
  };
  return { supabase: { from, rpc }, rows, profileUpdates, continuity, profile };
}

const paidSession = {
  id: "cs_live_smoke_check",
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  amount_total: 29900,
  currency: "usd",
  line_items: {
    data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }],
    has_more: false,
  },
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
    const logged = errSpy.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    errSpy.mockRestore();

    expect(result).toEqual({
      handled: true,
      profileId: "prof_1",
      activationEmail: "failed",
    });
    expect(logged).toContain("[dpp-fulfill] activation email failed");
    expect(logged).toContain("session=cs_live_smoke_check");
    expect(logged).toContain("status=422");
    expect(logged).not.toContain("buyer@example.com");
    expect(logged).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);

    const failed = rows.filter(
      r => r.event_type === "dpp_activation_email:failed"
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      prospect_id: "smoke_check_1",
      stage: "complete_checkout",
    });
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
    vi.mocked(sendEmail).mockRejectedValueOnce(
      new Error("connect ETIMEDOUT for buyer@example.com")
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    const logged = errSpy.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    errSpy.mockRestore();

    expect(result.activationEmail).toBe("failed");
    expect(logged).toContain("ETIMEDOUT");
    expect(logged).not.toContain("buyer@example.com");
    expect(
      rows.filter(r => r.event_type === "dpp_activation_email:failed")
    ).toHaveLength(1);
  });

  it("writes no failure row when the send succeeds", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    expect(result.activationEmail).toBe("sent");
    expect(rows.some(r => r.event_type === "dpp_activation_email:failed")).toBe(
      false
    );
  });

  it("redactForLog strips addresses and caps length", () => {
    expect(redactForLog("bad to: a.b+c@sub.example.co.uk, retry")).toBe(
      "bad to: [redacted], retry"
    );
    expect(redactForLog(undefined)).toBe("unknown");
    expect(redactForLog("x".repeat(500))).toHaveLength(200);
  });

  it("no-ops when the session is not a DPP offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_other",
      metadata: { plan: "starter" },
    });
    expect(result).toEqual({
      handled: false,
      profileId: null,
      activationEmail: "skipped",
    });
    expect(rows).toHaveLength(0);
  });

  it("treats the catalog price id as a DPP offer without metadata.offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(
      supabase,
      {
        id: "cs_price_only",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        amount_total: 29900,
        currency: "usd",
        line_items: {
          data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }],
          has_more: false,
        },
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
      mode: "payment",
      status: "complete",
      payment_status: "paid",
      currency: "usd",
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

  it("does not grant a completed demo session again after a later purchase", async () => {
    const { supabase, profileUpdates } = fakeSupabase();
    const demoSession = {
      ...paidSession,
      id: "cs_demo_once",
      metadata: {
        ...paidSession.metadata,
        is_demo: "true",
        promo: "DPP-SMOKE-E2E",
      },
    };
    const laterPaidSession = {
      ...paidSession,
      id: "cs_paid_later",
      amount_total: 29900,
      metadata: { ...paidSession.metadata, visit_id: "paid_later" },
    };

    await fulfillDppPaidSession(supabase, demoSession);
    await fulfillDppPaidSession(supabase, laterPaidSession);
    expect(profileUpdates.map(update => update.generations_limit)).toEqual([
      50, 100,
    ]);

    const replay = await fulfillDppPaidSession(supabase, demoSession);

    expect(profileUpdates).toHaveLength(2);
    expect(replay.alreadyFulfilled).toBe(true);
  });

  it("writes payment_succeeded before provision on a paid session", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    expect(result).toEqual({
      handled: true,
      profileId: "prof_1",
      activationEmail: "sent",
    });
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

  it("throws for a real paid session with no buyer identity and does not record provisioned", async () => {
    const { supabase, rows } = fakeSupabase({ profileId: null });
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        customer_details: null,
        customer_email: null,
        metadata: { ...paidSession.metadata, user_id: "" },
      })
    ).rejects.toMatchObject({
      name: "RetryableFulfillmentError",
      message: expect.stringMatching(/^DPP provision failed: no_identity/),
    });
    expect(rows.map(r => r.event_type)).toEqual(["dpp_loop:payment_succeeded"]);
  });

  it("emits fulfillment.started then fulfillment.failed, never entitlement.granted, when nothing was granted", async () => {
    const { supabase } = fakeSupabase({ profileId: null });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await fulfillDppPaidSession(supabase, {
        ...paidSession,
        customer_details: null,
        customer_email: null,
        metadata: { ...paidSession.metadata, user_id: "" },
      }).catch(() => undefined);
      const events = log.mock.calls
        .map(c => String(c[0]))
        .filter(l => l.includes("authichain.trust-event/1"))
        .map(l => JSON.parse(l).event);
      expect(events).toEqual(["fulfillment.started", "fulfillment.failed"]);
    } finally {
      log.mockRestore();
    }
  });

  it("emits entitlement.granted and fulfillment.completed for a granted session, with no buyer address", async () => {
    const { supabase } = fakeSupabase();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await fulfillDppPaidSession(supabase, paidSession);
      const lines = log.mock.calls
        .map(c => String(c[0]))
        .filter(l => l.includes("authichain.trust-event/1"));
      expect(lines.map(l => JSON.parse(l).event)).toEqual([
        "fulfillment.started",
        "entitlement.granted",
        "fulfillment.completed",
      ]);
      expect(lines.join(String.fromCharCode(10))).not.toContain(
        "buyer@example.com"
      );
    } finally {
      log.mockRestore();
    }
  });

  it("a demo session with no buyer identity still records provisioned with skip_reason", async () => {
    const { supabase, rows } = fakeSupabase({ profileId: null });
    const result = await fulfillDppPaidSession(supabase, {
      ...paidSession,
      customer_details: null,
      customer_email: null,
      metadata: {
        ...paidSession.metadata,
        user_id: "",
        is_demo: "true",
        promo: "DPP-SMOKE-E2E",
      },
      amount_total: 0,
    });
    expect(result).toEqual({
      handled: true,
      profileId: null,
      activationEmail: "skipped",
    });
    expect(rows.map(r => r.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(rows[1].metadata).toMatchObject({
      loop_stage: "provisioned",
      skip_reason: "no_identity",
    });
  });

  it("throws when the entitlement update fails and does not record provisioned", async () => {
    const { supabase, rows } = fakeSupabase({
      updateError: {
        message:
          "Could not find the 'subscribed_at' column of 'profiles' in the schema cache",
      },
    });
    await expect(fulfillDppPaidSession(supabase, paidSession)).rejects.toThrow(
      /subscribed_at/
    );
    expect(rows.map(r => r.event_type)).toEqual(["dpp_loop:payment_succeeded"]);
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
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        currency: "usd",
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
      mode: "payment",
      status: "complete",
      payment_status: "paid",
      currency: "usd",
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
    expect(result).toEqual({
      handled: true,
      profileId: "prof_guest",
      activationEmail: "skipped",
    });
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
    const { supabase, rows, profileUpdates, continuity } = fakeSupabase();
    await fulfillDppPaidSession(supabase, paidSession);
    await fulfillDppPaidSession(supabase, paidSession);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:payment_succeeded")
    ).toHaveLength(1);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:provisioned")
    ).toHaveLength(1);
    expect(
      profileUpdates.filter(patch => patch.generations_used === 0)
    ).toHaveLength(1);
    expect(profileUpdates[0]).toMatchObject({
      generations_limit: 50,
      generations_used: 0,
      last_grant_session_id: paidSession.id,
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    const actions = continuity.get("founder_exit_actions") ?? [];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.state).toBe("succeeded");
    expect(continuity.get("founder_exit_side_effects")).toHaveLength(1);
  });

  it("does not regrant a legacy session already marked on the profile", async () => {
    const { supabase, rows, profileUpdates, continuity } = fakeSupabase({
      preGrantedSessionId: paidSession.id,
    });

    const result = await fulfillDppPaidSession(supabase, paidSession);

    expect(result).toMatchObject({
      handled: true,
      profileId: "prof_1",
    });
    expect(profileUpdates).toHaveLength(0);
    expect(
      continuity
        .get("founder_exit_side_effects")
        ?.map(row => row.idempotency_key)
    ).toEqual([`grant:${paidSession.id}`]);
    expect(rows.map(row => row.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
  });

  it("recovers provisioned recording after the atomic grant receipt was committed", async () => {
    const { supabase, rows, profileUpdates, continuity, profile } =
      fakeSupabase({
        failContinuityUpdateOnce: true,
      });

    await expect(
      fulfillDppPaidSession(supabase, paidSession)
    ).rejects.toMatchObject({ name: "RetryableFulfillmentError" });
    expect(rows.map(row => row.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
    ]);
    expect(profileUpdates).toHaveLength(1);
    if (profile) profile.last_grant_session_id = "cs_later_checkout";

    const result = await fulfillDppPaidSession(supabase, paidSession);

    expect(result).toMatchObject({
      handled: true,
      profileId: "prof_1",
      alreadyFulfilled: true,
    });
    expect(rows.map(row => row.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(profileUpdates).toHaveLength(1);
    expect(continuity.get("founder_exit_actions")?.[0]?.state).toBe(
      "succeeded"
    );
  });

  it("recovers a missing provisioned event after continuity already succeeded", async () => {
    const { supabase, rows, profileUpdates } = fakeSupabase({
      failProvisionedEventOnce: true,
    });

    await expect(
      fulfillDppPaidSession(supabase, paidSession)
    ).resolves.toMatchObject({ handled: true });
    expect(rows.map(row => row.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
    ]);
    expect(profileUpdates).toHaveLength(1);

    const result = await fulfillDppPaidSession(supabase, paidSession);

    expect(result).toMatchObject({
      handled: true,
      profileId: "prof_1",
      alreadyFulfilled: true,
    });
    expect(rows.map(row => row.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(profileUpdates).toHaveLength(1);
  });

  it("does not provision a complete-but-unpaid checkout", async () => {
    const { supabase, rows, profileUpdates } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      ...paidSession,
      payment_status: "unpaid",
    });
    expect(result.handled).toBe(false);
    expect(rows).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("holds a paid session that only claims its price in metadata", async () => {
    const { supabase, rows, profileUpdates } = fakeSupabase();
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        line_items: null,
        metadata: { ...paidSession.metadata, stripe_price_id: DPP_PRICE_ID },
      })
    ).rejects.toThrow(/DPP grant blocked/);
    expect(rows).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
  });

  it("holds a wrong-product DPP claim before any entitlement write", async () => {
    const { supabase, profileUpdates } = fakeSupabase();
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        line_items: { data: [{ price: { id: "price_other" } }] },
      })
    ).rejects.toThrow(/DPP grant blocked/);
    expect(profileUpdates).toHaveLength(0);
  });

  it("holds a paid checkout with a truncated Stripe line-item list", async () => {
    const { supabase, rows, profileUpdates } = fakeSupabase();
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        line_items: {
          data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }],
          has_more: true,
        },
      })
    ).rejects.toThrow(/DPP grant blocked/);
    expect(rows).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("holds a paid checkout without explicit quantity", async () => {
    const { supabase, rows, profileUpdates } = fakeSupabase();
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        line_items: {
          data: [{ price: { id: DPP_PRICE_ID } }],
          has_more: false,
        },
      })
    ).rejects.toThrow(/DPP grant blocked/);
    expect(rows).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("holds a paid but incomplete checkout", async () => {
    const { supabase, profileUpdates } = fakeSupabase();
    await expect(
      fulfillDppPaidSession(supabase, {
        ...paidSession,
        status: "open",
      })
    ).rejects.toThrow(/DPP grant blocked/);
    expect(profileUpdates).toHaveLength(0);
  });
});
