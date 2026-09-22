import { afterEach, describe, expect, it } from "vitest";
import {
  BASE_USDC,
  CHAINS,
  COINBASE_SMART_WALLET,
  GOVCHAIN_SIGNER,
  NFT_CLUSTER_KNOWN,
  NFT_DEPLOYER_EOA,
  POLYGON_AUTHICHAIN_NFT,
  POLYGON_DEPLOYER,
  QRON_DECIMALS,
  QRON_ERC20,
  QRON_FACTORY_CALLER,
  QRON_HOLDER_EOA,
  QRON_TOTAL_SUPPLY,
  TOKENOMICS_PAY_TO,
  resolveChain,
  rpcUrl,
} from "./evm-chains.ts";
import { BASE_USDC_ASSET, X402_PUBLISHED_PAY_TO } from "../../src/lib/x402.ts";

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

describe("canonical web3 identity", () => {
  it("names wallets and tokens without mixing ops roles", () => {
    expect(COINBASE_SMART_WALLET).toBe(
      "0xC0D26735fd9e868eacc60400ef3171Fa4161177f"
    );
    expect(GOVCHAIN_SIGNER).toBe(COINBASE_SMART_WALLET);
    expect(NFT_DEPLOYER_EOA).toBe(
      "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d"
    );
    expect(POLYGON_DEPLOYER).toBe(NFT_DEPLOYER_EOA);
    expect(TOKENOMICS_PAY_TO.toLowerCase()).toBe(
      "0xaebfa6b08fb25b59748c93273ab8880e20ffe437" // pragma: allowlist secret
    );
    expect(QRON_HOLDER_EOA).toBe(
      "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2"
    );
    expect(QRON_HOLDER_EOA.toLowerCase()).not.toBe(
      TOKENOMICS_PAY_TO.toLowerCase()
    );
    expect(QRON_FACTORY_CALLER).toBe(
      "0x8df0057ffb210444b927511b2d416ad7854fb81e"
    );
    expect(QRON_ERC20).toBe("0xAebfA6b08fb25b59748c93273aB8880e20FfE437");
    expect(BASE_USDC).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(NFT_CLUSTER_KNOWN).toBe(
      "0x52981cd11973f954d9ea084a784650f65d052235"
    );
    expect(QRON_DECIMALS).toBe(18);
    expect(QRON_TOTAL_SUPPLY).toBe(1_000_000_000);
    expect(TOKENOMICS_PAY_TO).toBe(X402_PUBLISHED_PAY_TO);
    expect(BASE_USDC).toBe(BASE_USDC_ASSET);
  });

  it("keeps Smart Wallet, payTo, and NFT deployer as three distinct addresses", () => {
    const named = [
      COINBASE_SMART_WALLET,
      TOKENOMICS_PAY_TO,
      QRON_HOLDER_EOA,
      NFT_DEPLOYER_EOA,
      QRON_FACTORY_CALLER,
      QRON_ERC20,
      POLYGON_AUTHICHAIN_NFT,
      BASE_USDC,
      NFT_CLUSTER_KNOWN,
    ].map((a) => a.toLowerCase());
    expect(new Set(named).size).toBe(named.length);
  });
});
