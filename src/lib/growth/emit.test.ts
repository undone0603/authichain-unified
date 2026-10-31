import { describe, expect, it } from "vitest";
import { FOUNDER_EMAILS } from "../billing/live-catalog";
import {
  GrowthEventError,
  buildGrowthEvent,
  hashEmail,
  isGrowthEvent,
  loopForEvent,
} from "./emit";
import { GROWTH_LOOPS } from "./loops";

describe("growth event contract 2026-09-28", () => {
  it("accepts every event declared by every loop", () => {
    for (const loop of GROWTH_LOOPS) {
      for (const event of loop.events) {
        expect(isGrowthEvent(event)).toBe(true);
        expect(loopForEvent(event, loop.sku)).toBe(loop.id);
      }
    }
  });

  it("rejects an unknown event name", () => {
    expect(isGrowthEvent("purchase_seal_succeeded")).toBe(false);
  });

  it("resolves shared events by sku", () => {
    // checkout_abandoned belongs to all three loops; sku disambiguates.
    expect(loopForEvent("checkout_abandoned", "starter")).toBe("loop_03_qron_starter");
    expect(loopForEvent("checkout_abandoned", "dpp_readiness")).toBe("loop_02_dpp_check");
    expect(loopForEvent("checkout_abandoned", "strainchain_passport")).toBe("loop_01_passport_scan");
  });

  it("refuses an event that its loop does not declare", async () => {
    // genetics_view is LOOP-01 only; pairing it with starter is a wiring bug.
    await expect(buildGrowthEvent({ event: "genetics_view", sku: "starter" })).rejects.toBeInstanceOf(
      GrowthEventError,
    );
  });
});

describe("founder labelling", () => {
  it("marks every founder address as founder", async () => {
    for (const email of FOUNDER_EMAILS) {
      const p = await buildGrowthEvent({ event: "purchase_starter_succeeded", sku: "starter", email });
      expect(p.founder).toBe(true);
    }
  });

  it("is case and whitespace insensitive", async () => {
    const p = await buildGrowthEvent({
      event: "purchase_starter_succeeded",
      sku: "starter",
      email: "  AuthiChain@Gmail.com  ",
    });
    expect(p.founder).toBe(true);
  });

  it("treats a stranger as non-founder", async () => {
    const p = await buildGrowthEvent({
      event: "purchase_starter_succeeded",
      sku: "starter",
      email: "buyer@example.com",
    });
    expect(p.founder).toBe(false);
  });

  it("treats an anonymous event as non-founder with no hash", async () => {
    const p = await buildGrowthEvent({ event: "generate_view", sku: "starter" });
    expect(p.founder).toBe(false);
    expect(p.email_hash).toBeUndefined();
  });
});

describe("email privacy", () => {
  it("never emits the raw address", async () => {
    const email = "buyer@example.com";
    const p = await buildGrowthEvent({ event: "checkout_email_captured", sku: "starter", email });
    expect(JSON.stringify(p)).not.toContain(email);
    expect(p.email_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes deterministically after normalisation", async () => {
    const a = await hashEmail("Buyer@Example.com");
    const b = await hashEmail("  buyer@example.com ");
    expect(a).toBe(b);
  });

  it("distinguishes different addresses", async () => {
    expect(await hashEmail("a@example.com")).not.toBe(await hashEmail("b@example.com"));
  });
});

describe("payload shape", () => {
  it("carries loop, sku, founder and occurred_at", async () => {
    const at = new Date("2026-09-29T12:00:00.000Z");
    const p = await buildGrowthEvent({
      event: "checkout_session_started",
      sku: "starter",
      occurredAt: at,
    });
    expect(p).toMatchObject({
      event: "checkout_session_started",
      loop: "loop_03_qron_starter",
      sku: "starter",
      founder: false,
      occurred_at: "2026-09-29T12:00:00.000Z",
    });
  });
});
