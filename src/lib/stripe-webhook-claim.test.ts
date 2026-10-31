import { describe, expect, it } from "vitest";
import {
  STRIPE_CLAIM_STALE_MS,
  claimStripeEvent,
} from "./stripe-webhook-claim";

type Row = { event_id: string; status: string | null; processed_at: string };

/** In-memory stand-in for public.stripe_events (PRIMARY KEY event_id). */
export function fakeStripeEvents(
  opts: { upsertError?: { code: string; message: string } } = {}
) {
  const rows = new Map<string, Row>();
  const supabase = {
    from: (table: string) => {
      if (table !== "stripe_events") throw new Error(`unexpected ${table}`);
      return {
        upsert: (
          row: Row,
          o: { onConflict: string; ignoreDuplicates?: boolean }
        ) => ({
          select: async () => {
            if (opts.upsertError)
              return { data: null, error: opts.upsertError };
            if (rows.has(row.event_id)) {
              if (o.ignoreDuplicates) return { data: [], error: null };
              Object.assign(rows.get(row.event_id)!, row);
            } else {
              rows.set(row.event_id, { ...row });
            }
            return { data: [{ event_id: row.event_id }], error: null };
          },
        }),
        update: (patch: Partial<Row>) => {
          let id = "";
          let orFilter = "";
          const chain = {
            eq: (_c: string, v: string) => ((id = v), chain),
            or: (f: string) => ((orFilter = f), chain),
            select: async () => {
              const row = rows.get(id);
              const stale =
                /processed_at\.lt\."([^"]+)"/.exec(orFilter)?.[1] ?? "";
              const ok =
                !!row &&
                (row.status === "error" ||
                  (row.status === "received" && row.processed_at < stale));
              if (!ok) return { data: [], error: null };
              Object.assign(row!, patch);
              return { data: [{ event_id: id }], error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { rows, supabase };
}

describe("claimStripeEvent (stripe_events, on conflict do nothing)", () => {
  it("claims the first delivery and reports the second as a duplicate", async () => {
    const { supabase, rows } = fakeStripeEvents();
    expect(await claimStripeEvent(supabase, "evt_1", "invoice.paid")).toBe(
      "claimed"
    );
    expect(await claimStripeEvent(supabase, "evt_1", "invoice.paid")).toBe(
      "duplicate"
    );
    rows.get("evt_1")!.status = "success";
    expect(await claimStripeEvent(supabase, "evt_1", "invoice.paid")).toBe(
      "duplicate"
    );
  });

  it("lets Stripe's retry re-claim an event whose first delivery errored", async () => {
    const { supabase, rows } = fakeStripeEvents();
    await claimStripeEvent(supabase, "evt_2", "invoice.paid");
    rows.get("evt_2")!.status = "error";
    expect(await claimStripeEvent(supabase, "evt_2", "invoice.paid")).toBe(
      "claimed"
    );
    expect(await claimStripeEvent(supabase, "evt_2", "invoice.paid")).toBe(
      "duplicate"
    );
  });

  it("re-claims a stale 'received' row (crashed Worker) but not a fresh one", async () => {
    const { supabase } = fakeStripeEvents();
    const t0 = new Date("2026-10-09T05:00:00.000Z");
    await claimStripeEvent(supabase, "evt_3", "x", t0);
    const soon = new Date(t0.getTime() + 60_000);
    expect(await claimStripeEvent(supabase, "evt_3", "x", soon)).toBe(
      "duplicate"
    );
    const later = new Date(t0.getTime() + STRIPE_CLAIM_STALE_MS + 60_000);
    expect(await claimStripeEvent(supabase, "evt_3", "x", later)).toBe(
      "claimed"
    );
  });

  it("fails open when the write errors or there is no client", async () => {
    const { supabase } = fakeStripeEvents({
      upsertError: { code: "42703", message: "column missing" },
    });
    expect(await claimStripeEvent(supabase, "evt_4", "x")).toBe("unavailable");
    expect(await claimStripeEvent(null, "evt_4", "x")).toBe("unavailable");
    expect(
      await claimStripeEvent(
        {
          from: () => {
            throw new Error("boom");
          },
        },
        "evt_4",
        "x"
      )
    ).toBe("unavailable");
  });
});
