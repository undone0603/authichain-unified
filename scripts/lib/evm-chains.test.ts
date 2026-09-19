import { afterEach, describe, expect, it } from "vitest";
import { CHAINS, POLYGON_AUTHICHAIN_NFT, resolveChain, rpcUrl } from "./evm-chains.ts";

const KEYS = ["CHAIN", "CHAIN_ID", "ALCHEMY_API_KEY"] as const;
const prior = new Map<string, string | undefined>();

function setEnv(values: Record<string, string | undefined>) {
  for (const key of KEYS) {
    if (!prior.has(key)) prior.set(key, process.env[key]);
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of prior) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  prior.clear();
});

describe("resolveChain", () => {
  it("defaults to Base mainnet for GovChain pilots", () => {
    setEnv({ CHAIN: undefined, CHAIN_ID: undefined });
    expect(resolveChain()).toEqual(CHAINS.base);
    expect(resolveChain().chainId).toBe(8453);
  });

  it("accepts chain keys and numeric ids", () => {
    setEnv({ CHAIN: "base" });
    expect(resolveChain().key).toBe("base");
    setEnv({ CHAIN: "8453" });
    expect(resolveChain().chainId).toBe(8453);
    setEnv({ CHAIN: "polygon" });
    expect(resolveChain()).toEqual(CHAINS.polygon);
    setEnv({ CHAIN: "137" });
    expect(resolveChain().chainId).toBe(137);
  });
});

describe("rpcUrl", () => {
  it("uses public Base RPC when Alchemy is unset", () => {
    setEnv({ ALCHEMY_API_KEY: undefined });
    expect(rpcUrl(CHAINS.base)).toBe("https://mainnet.base.org");
  });

  it("does not embed the Alchemy key in the public fallback", () => {
    setEnv({ ALCHEMY_API_KEY: "test-key" });
    expect(rpcUrl(CHAINS.base)).toBe("https://base-mainnet.g.alchemy.com/v2/test-key");
    expect(CHAINS.base.publicRpc).not.toContain("test-key");
  });
});

describe("known contracts", () => {
  it("keeps the live Polygon AuthiChainNFT as the interim fallback only", () => {
    expect(POLYGON_AUTHICHAIN_NFT).toBe("0x4da4D2675e52374639C9c954f4f653887A9972BE");
  });
});
