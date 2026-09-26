// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  NURTURE_HELD,
  NURTURE_SCHEDULE,
  planQueueFromReply,
  resolveNurtureMode,
  runNurtureTick,
} from "./nurture-replies";

describe("planQueueFromReply", () => {
  it("skips unmatched, paused, neutral, and negative", () => {
    expect(planQueueFromReply({ leadId: null, sentiment: "positive" })).toEqual({
      action: "skip",
      reason: "unmatched",
    });
    expect(
      planQueueFromReply({ leadId: 1, sentiment: "positive", nurturePaused: true })
    ).toEqual({ action: "skip", reason: "nurture_paused" });
    expect(planQueueFromReply({ leadId: 1, sentiment: "neutral" }).action).toBe(
      "skip"
    );
    expect(planQueueFromReply({ leadId: 1, sentiment: "negative" }).action).toBe(
      "skip"
    );
  });

  it("queues positive and budget objections with the documented delays", () => {
    const pos = planQueueFromReply({ leadId: 9, sentiment: "positive" });
    expect(pos).toMatchObject({
      action: "queue",
      templateType: "positive_followup",
      delayMs: 2 * 60 * 60 * 1000,
    });
    const bud = planQueueFromReply({
      leadId: 9,
      sentiment: "objection",
      objectionType: "budget",
    });
    expect(bud).toMatchObject({
      action: "queue",
      templateType: "objection_budget",
      delayMs: 4 * 60 * 60 * 1000,
    });
  });
});

describe("resolveNurtureMode", () => {
  it("defaults to dry-run and stays held without NURTURE_SEND_ENABLED", () => {
    expect(resolveNurtureMode(new URL("https://app.authichain.com/x"), false)).toEqual({
      mode: "dry-run",
    });
    const blocked = resolveNurtureMode(
      new URL("https://app.authichain.com/x?send=1"),
      false
    );
    expect(blocked.mode).toBe("dry-run");
    expect(blocked.blockedReason).toMatch(/NURTURE_SEND_ENABLED/);
  });

  it("allows send only when the flag and query are both set", () => {
    expect(
      resolveNurtureMode(new URL("https://app.authichain.com/x?send=1"), true)
    ).toEqual({ mode: "send" });
  });
});

describe("runNurtureTick dry-run", () => {
  it("plans a queue without writing", async () => {
    const writes: string[] = [];
    const admin = {
      from(table: string) {
        const builder: any = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          lte: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({
            data:
              table === "leads"
                ? { id: 42, name: "Pat", company: "Acme", nurturePaused: false }
                : null,
          }),
          then(resolve: (v: unknown) => void) {
            if (table === "inbound_replies") {
              resolve({
                data: [
                  {
                    id: "r1",
                    lead_id: 42,
                    lead_email: "buyer@example.com",
                    sentiment: "positive",
                    objection_type: null,
                    status: "new",
                  },
                ],
                error: null,
              });
              return;
            }
            resolve({ data: [], error: null });
          },
          insert: async () => {
            writes.push("insert");
            return { error: null };
          },
          update() {
            return {
              eq: async () => {
                writes.push("update");
                return { error: null };
              },
            };
          },
        };
        return builder;
      },
    };
    const result = await runNurtureTick({ admin, mode: "dry-run" });
    expect(result.mode).toBe("dry-run");
    expect(result.queued).toBe(0);
    expect(result.planned.some(p => p.action === "would_queue")).toBe(true);
    expect(writes).toEqual([]);
  });
});

describe("GROUP B hold", () => {
  it("stays held and off the hourly dispatcher", () => {
    expect(NURTURE_HELD).toBe(true);
    expect(NURTURE_SCHEDULE).toBe("0 */2 * * *");
    const dispatch = readFileSync(
      fileURLToPath(new URL("./cron-dispatch.ts", import.meta.url)),
      "utf8"
    );
    expect(dispatch).not.toMatch(/nurture-replies/);
    const wrangler = readFileSync(
      fileURLToPath(new URL("./wrangler.toml", import.meta.url)),
      "utf8"
    );
    expect(wrangler).toMatch(/nurture-replies/);
    expect(wrangler).toMatch(/crons_HELD/);
    expect(wrangler).not.toMatch(/^\s*crons\s*=/m);
  });
});
