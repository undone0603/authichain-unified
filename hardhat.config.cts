import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";

/**
 * Hardhat project for on-chain contracts under contracts/ (AuthiChainLedger,
 * AuthiChainNFT, etc). Kept deliberately minimal — no toolbox, no chai
 * matchers — tests use node:assert (see test/AuthiChainLedger.test.ts).
 *
 *   npx hardhat test
 *   npx hardhat run scripts/ledger/deploy.ts --network amoy
 *
 * sources stay scoped to contracts/ledger. AuthiChainNFT is deployed with
 * thirdweb or scripts/deploy-authichain-nft-base.ts, not this compile path.
 */
const accounts = process.env.MINTER_PRIVATE_KEY
  ? [process.env.MINTER_PRIVATE_KEY]
  : process.env.WALLET_PRIVATE_KEY
    ? [process.env.WALLET_PRIVATE_KEY]
    : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts/ledger",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts,
      chainId: 80002,
    },
    polygon: {
      url: process.env.NFT_RPC_URL || process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts,
      chainId: 137,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts,
      chainId: 8453,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts,
      chainId: 84532,
    },
  },
};

export default config;
