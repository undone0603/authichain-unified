import { describe, expect, it, vi } from "vitest";
import {
  checkoutSessionIdFromEvent,
  recordStripeWebhookDelivery,
} from "./stripe-webhook-log";

function fakeSupabase(opts: {
  richError?: { message: string } | null;
  baseError?: { message: string } | null;
}) {
  const upserts: Array<Record<string, unknown>> = [];
  return {
    rows: upserts,
    supabase: {
      from: () => ({
        upsert: async (row: Record<string, unknown>) => {
          upserts.push(row);
          if ("status" in row) {
            return { error: opts.richError ?? null };
          }
          return { error: opts.baseError ?? null };
        },
      }),
    },
  };
}

describe("recordStripeWebhookDelivery", () => {
  it("writes event id, type, session id, status, and error on the rich schema", async () => {
    const { supabase, rows } = fakeSupabase({});
    const result = await recordStripeWebhookDelivery(supabase, {
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      sessionId: "cs_live_a1y4Tu",
      status: "error",
      httpStatus: 400,
      error: "DATABASE_URL environment variable is not set",
    });
    expect(result).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event_id: "evt_1",
      event_type: "checkout.session.completed",
      session_id: "cs_live_a1y4Tu",
      status: "error",
      http_status: 400,
      error: "DATABASE_URL environment variable is not set",
    });
  });

  it("falls back to event_id/type/processed_at when extra columns are missing", async () => {
    const { supabase, rows } = fakeSupabase({
      richError: { message: 'column "session_id" does not exist' },
    });
    const result = await recordStripeWebhookDelivery(supabase, {
      eventId: "evt_2",
      eventType: "checkout.session.completed",
      sessionId: "cs_live_a1y4Tu",
      status: "received",
    });
    expect(result).toEqual({ ok: true, detail: "base_columns_only" });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      event_id: "evt_2",
      event_type: "checkout.session.completed",
      processed_at: expect.any(String),
    });
  });

  it("does not throw when Supabase is unset", async () => {
    await expect(
      recordStripeWebhookDelivery(null, {
        eventId: "evt_3",
        eventType: "checkout.session.completed",
        status: "received",
      })
    ).resolves.toEqual({ ok: false, detail: "no_supabase" });
  });
});

describe("checkoutSessionIdFromEvent", () => {
  it("reads the checkout session id from checkout.session.* events", () => {
    expect(
      checkoutSessionIdFromEvent({
        type: "checkout.session.completed",
        data: { object: { id: "cs_live_a1y4Tu" } },
      })
    ).toBe("cs_live_a1y4Tu");
    expect(
      checkoutSessionIdFromEvent({
        type: "invoice.paid",
        data: { object: { id: "in_1" } },
      })
    ).toBeNull();
  });
});
