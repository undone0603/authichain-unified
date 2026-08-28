import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";

/**
 * Hardhat project for on-chain contracts under contracts/ (AuthiChainLedger,
 * AuthiChainNFT, etc). Kept deliberately minimal — no toolbox, no chai
 * matchers — tests use node:assert (see test/AuthiChainLedger.test.ts).
 *
 *   npx hardhat test
 *   npx hardhat run scripts/ledger/deploy.ts --network amoy
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    // Scoped to the ledger contract only. The rest of contracts/ (AuthiChainNFT
    // and friends) predates any build tooling and some of it has imports that
    // don't resolve as a Hardhat project — out of scope here.
    sources: "./contracts/ledger",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
      chainId: 80002,
    },
    polygon: {
      url: process.env.NFT_RPC_URL || process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
      chainId: 137,
    },
  },
};

export default config;
