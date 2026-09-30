import { describe, expect, it } from "vitest";
import { APP_PREFIXES } from "./app-prefixes";

describe("APP_PREFIXES", () => {
  it("forwards every public dynamic worker-app prefix", () => {
    for (const prefix of [
      "/verify",
      "/status",
      "/grants",
      "/gallery",
      "/reveal",
      "/s",
      "/brand/qron/artwork",
      "/landing",
      "/p",
      "/onboard",
      "/checkout",
      "/story",
      "/dashboard",
      "/dapp",
      "/generate",
      "/login",
      "/authenticate",
    ]) {
      expect(APP_PREFIXES, prefix).toContain(prefix);
    }
  });
});
