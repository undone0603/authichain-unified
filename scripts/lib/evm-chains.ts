/**
 * Shared EVM chain targets and AuthiChain web3 identity constants.
 *
 * Canonical names and “do not mix” rules: docs/strategy/WEB3_IDENTITY.md
 * Do not invent addresses. Do not rebind X402_PAY_TO away from the
 * owner-authorized treasury 0xaebf…e437.
 * $QRON is not x402.
 */

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

/** AuthiChainNFT ERC-721 — Polygon 137 only. Empty getCode on Base 8453. */
export const POLYGON_AUTHICHAIN_NFT =
  "0x4da4D2675e52374639C9c954f4f653887A9972BE";

/**
 * Coinbase Smart Wallet (ERC-4337). $QRON owner/tax. Human Coinbase actions
 * only. Cannot sign with ethers.Wallet.
 */
export const COINBASE_SMART_WALLET =
  "0xC0D26735fd9e868eacc60400ef3171Fa4161177f";
/** Alias: GovChain recipient / optional verifyManufacturer only. */
export const GOVCHAIN_SIGNER = COINBASE_SMART_WALLET;

/**
 * NFT deployer EOA. WALLET_PRIVATE_KEY / POLYGON_PRIVATE_KEY.
 * Distinct from the payTo / tokenomics EOA.
 */
export const NFT_DEPLOYER_EOA = "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d";
/** Alias kept for existing mint/deploy scripts. */
export const POLYGON_DEPLOYER = NFT_DEPLOYER_EOA;

/**
 * Former x402 payTo. Still holds nearly all Polygon $QRON. Not live
 * X402_PAY_TO — do not put this back on catalog/health.
 */
export const QRON_HOLDER_EOA = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";

/**
 * Owner-authorized x402 treasury (X402_PAY_TO / tokenomics EOA).
 * Receives Base USDC for live agent pay. Distinct from QRON_HOLDER_EOA
 * and the NFT deployer. Do not rebind away from this address.
 */
export const TOKENOMICS_PAY_TO = "0xaebfa6b08fb25b59748c93273ab8880e20ffe437"; // pragma: allowlist secret

/** Historical $QRON Smithii factory caller. Not an ops wallet. */
export const QRON_FACTORY_CALLER = "0x8df0057ffb210444b927511b2d416ad7854fb81e";

/** $QRON ERC-20 contract on Polygon. Not a wallet. Not an x402 asset. */
export const QRON_ERC20 = "0xAebfA6b08fb25b59748c93273aB8880e20FfE437";

/** Circle USDC on Base 8453. Live x402 asset. Do not rebind. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Additional known AuthiChainNFT recipient-cluster address
 * (scripts/ledger/reconstruct-authichain-nft-ledger.ts). Not an ops wallet.
 */
export const NFT_CLUSTER_KNOWN = "0x52981cd11973f954d9ea084a784650f65d052235";

export const QRON_DECIMALS = 18;
export const QRON_TOTAL_SUPPLY = 1_000_000_000;

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
