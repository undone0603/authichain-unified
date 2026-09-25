import { describe, expect, it } from "vitest";
import {
  GROWTH_DIRECTORIES,
  GROWTH_SISTERS,
  GROWTH_SKILLS,
  growthDiscovery,
  x402ListingPack,
} from "./x402-growth";

const LIVE_PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
// $QRON ERC-20 contract on Polygon — must never appear as a wallet.
const STALE_PAY_TO = "0xaebfa6b08fb25b59748c93273ab8880e20ffe437"; // pragma: allowlist secret

describe("x402ListingPack", () => {
  it("copies wallet and price from health and never invents the $QRON contract", () => {
    const pack = x402ListingPack({
      payTo: LIVE_PAY_TO,
      pricePerCall: { usd: 0.05, atomic: "50000" },
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ready: true,
      status: "ready",
    });
    expect(pack.wallet).toBe(LIVE_PAY_TO);
    expect(pack.payapi.form.wallet).toBe(LIVE_PAY_TO);
    expect(pack.priceUsd).toBe(0.05);
    expect(pack.paidRoute).toBe("https://authichain.govchain.us/api/v1/agent-verify");
    expect(pack.category).toBe("Verification");
    expect(pack.endpoints).toBe(2);
    expect(pack.tools).toBe(3);
    expect(JSON.stringify(pack)).not.toContain(STALE_PAY_TO);
    expect(pack.ready).toBe(true);
  });

  it("leaves wallet null when health has no payTo", () => {
    const pack = x402ListingPack({ ready: false, status: "not_configured" });
    expect(pack.wallet).toBeNull();
    expect(pack.ready).toBe(false);
    expect(pack.priceUsd).toBe(0.05);
  });
});

describe("growthDiscovery", () => {
  it("exposes directories, sisters, and skills on one rail", () => {
    const body = growthDiscovery({
      payTo: LIVE_PAY_TO,
      ready: true,
      status: "ready",
      pricePerCall: { usd: 0.05, atomic: "50000" },
    });
    expect(body.loops.discovery).toContain("listing pack");
    expect(body.directories.map(d => d.id)).toEqual(
      GROWTH_DIRECTORIES.map(d => d.id)
    );
    expect(body.sisters.map(s => s.origin)).toEqual(
      GROWTH_SISTERS.map(s => s.origin)
    );
    expect(body.skills.map(s => s.id)).toEqual(GROWTH_SKILLS.map(s => s.id));
    expect(body.pack.wallet).toBe(LIVE_PAY_TO);
    expect(body.sisters.every(s => s.origin.startsWith("https://"))).toBe(true);
    expect(GROWTH_DIRECTORIES.some(d => d.id === "payapi")).toBe(true);
  });
});
