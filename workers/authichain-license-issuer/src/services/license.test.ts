import { describe, expect, it } from "vitest";
import { seatsForTier, tierFromPriceId } from "./license";
import type { Env } from "../index";

function env(overrides: Partial<Env> = {}): Env {
  return {
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_AGENT_BROWSER_PRO_PRICE_ID: "price_pro",
    STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID: "price_ent",
    LICENSE_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----",
    LICENSE_PUBLIC_KEY_PEM: "-----BEGIN PUBLIC KEY-----",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_ADMIN_CHAT_ID: "",
    DATABASE: {} as D1Database,
    SESSIONS: {} as KVNamespace,
    ...overrides,
  };
}

describe("tierFromPriceId", () => {
  it("does not default an empty price id to pro", () => {
    expect(() => tierFromPriceId(env(), "")).toThrow(/missing price id/i);
  });

  it("maps the bound enterprise and pro price ids", () => {
    expect(tierFromPriceId(env(), "price_ent")).toBe("enterprise");
    expect(tierFromPriceId(env(), "price_pro")).toBe("pro");
    expect(seatsForTier("enterprise")).toBe(0);
    expect(seatsForTier("pro")).toBe(5);
  });

  it("refuses an unknown catalog price instead of issuing pro", () => {
    expect(() => tierFromPriceId(env(), "price_other")).toThrow(/unknown/i);
  });
});
