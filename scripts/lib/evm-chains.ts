/** Shared EVM chain targets for GovChain / AuthiChain mint scripts. */

export type ChainKey = "base" | "base-sepolia" | "polygon" | "polygon-amoy";

export interface ChainTarget {
  key: ChainKey;
  chainId: number;
  name: string;
  explorer: string;
  currency: "ETH" | "POL";
  alchemyHost: string;
  publicRpc: string;
}

export const CHAINS: Record<ChainKey, ChainTarget> = {
  base: {
    key: "base",
    chainId: 8453,
    name: "Base Mainnet",
    explorer: "https://basescan.org",
    currency: "ETH",
    alchemyHost: "base-mainnet.g.alchemy.com",
    publicRpc: "https://mainnet.base.org",
  },
  "base-sepolia": {
    key: "base-sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    currency: "ETH",
    alchemyHost: "base-sepolia.g.alchemy.com",
    publicRpc: "https://sepolia.base.org",
  },
  polygon: {
    key: "polygon",
    chainId: 137,
    name: "Polygon Mainnet",
    explorer: "https://polygonscan.com",
    currency: "POL",
    alchemyHost: "polygon-mainnet.g.alchemy.com",
    publicRpc: "https://polygon-rpc.com",
  },
  "polygon-amoy": {
    key: "polygon-amoy",
    chainId: 80002,
    name: "Polygon Amoy",
    explorer: "https://amoy.polygonscan.com",
    currency: "POL",
    alchemyHost: "polygon-amoy.g.alchemy.com",
    publicRpc: "https://rpc-amoy.polygon.technology",
  },
};

export const POLYGON_AUTHICHAIN_NFT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
export const GOVCHAIN_SIGNER = "0xC0D26735fd9e868eacc60400ef3171Fa4161177f";
export const POLYGON_DEPLOYER = "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d";

export function resolveChain(): ChainTarget {
  const raw = (process.env.CHAIN || process.env.CHAIN_ID || "base").toLowerCase();
  if (raw === "8453" || raw === "base") return CHAINS.base;
  if (raw === "84532" || raw === "base-sepolia" || raw === "basesepolia") return CHAINS["base-sepolia"];
  if (raw === "137" || raw === "polygon") return CHAINS.polygon;
  if (raw === "80002" || raw === "amoy" || raw === "polygon-amoy") return CHAINS["polygon-amoy"];
  return CHAINS.base;
}

export function rpcUrl(chain: ChainTarget): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (key) return `https://${chain.alchemyHost}/v2/${key}`;
  return chain.publicRpc;
}
