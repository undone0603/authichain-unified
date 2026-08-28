// scripts/deploy-authichain-nft-base.ts
// Deploy AuthiChainNFT to Base / Base Sepolia OR grant roles on an existing deploy.
//
// Why this is not `grantRole(MINTER_ROLE)` alone:
//   mintProduct also requires msg.sender to be a verified manufacturer
//   OR hold DEFAULT_ADMIN_ROLE. verifyManufacturer() sets both.
//
// The Coinbase Smart Wallet (0xC0D26735…) cannot sign with ethers.Wallet.
// Deploy + mint from an ops EOA. Optionally verifyManufacturer(Smart Wallet)
// so a human can mint from Coinbase Wallet later.
//
// Usage:
//   CHAIN=base-sepolia DRY_RUN=true  pnpm exec tsx scripts/deploy-authichain-nft-base.ts
//   CHAIN=base-sepolia DRY_RUN=false pnpm exec tsx scripts/deploy-authichain-nft-base.ts
//
// Required to send a tx:
//   WALLET_PRIVATE_KEY or MINTER_PRIVATE_KEY or POLYGON_PRIVATE_KEY  (ops EOA)
//   funded with Base Sepolia ETH
// Optional:
//   GOVCHAIN_NFT_CONTRACT / CONTRACT_ADDRESS  — skip deploy, grant only
//   ARTIFACT_PATH — compiled AuthiChainNFT.json for ContractFactory.deploy
//   GRANT_SMART_WALLET=true — also verifyManufacturer(GOVCHAIN_SIGNER)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import {
  GOVCHAIN_SIGNER,
  POLYGON_DEPLOYER,
  resolveChain,
  rpcUrl,
} from "./lib/evm-chains.js";

const DRY_RUN = process.env.DRY_RUN !== "false";
const GRANT_SMART_WALLET = process.env.GRANT_SMART_WALLET === "true";

const ROLE_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function MINTER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function isManufacturerVerified(address manufacturer) view returns (bool)",
  "function verifyManufacturer(address manufacturer)",
  "function grantRole(bytes32 role, address account)",
];

function privateKey(): string {
  return (
    process.env.WALLET_PRIVATE_KEY ||
    process.env.MINTER_PRIVATE_KEY ||
    process.env.POLYGON_PRIVATE_KEY ||
    ""
  ).trim();
}

function existingContract(): string {
  return (process.env.GOVCHAIN_NFT_CONTRACT || process.env.CONTRACT_ADDRESS || "").trim();
}

function artifactPath(): string {
  return (
    process.env.ARTIFACT_PATH ||
    join(process.cwd(), "artifacts", "contracts", "AuthiChainNFT.sol", "AuthiChainNFT.json")
  );
}

async function grantIfNeeded(
  contract: ethers.Contract,
  address: string,
  label: string,
  dry: boolean
) {
  const verified: boolean = await contract.isManufacturerVerified(address);
  const minterRole: string = await contract.MINTER_ROLE();
  const hasMinter: boolean = await contract.hasRole(minterRole, address);
  console.log(`[grant] ${label} ${address} verified=${verified} minter=${hasMinter}`);
  if (verified && hasMinter) return;
  if (dry) {
    console.log(`[grant] DRY_RUN would verifyManufacturer(${address})`);
    return;
  }
  const tx = await contract.verifyManufacturer(address);
  console.log(`[grant] verifyManufacturer tx=${tx.hash}`);
  await tx.wait();
}

async function main() {
  const chain = resolveChain();
  const key = privateKey();
  const provider = new ethers.JsonRpcProvider(rpcUrl(chain));
  const network = await provider.getNetwork();

  console.log(`[deploy-nft] chain=${chain.name} (${chain.chainId}) dryRun=${DRY_RUN}`);
  console.log(`[deploy-nft] rpc chainId=${Number(network.chainId)}`);

  if (Number(network.chainId) !== chain.chainId) {
    throw new Error(`RPC chainId ${network.chainId} != expected ${chain.chainId}`);
  }

  if (!key) {
    console.warn(
      "[deploy-nft] No ops EOA key. Set WALLET_PRIVATE_KEY (NOT the Smart Wallet)."
    );
    console.warn(
      `[deploy-nft] Fund ops EOA then faucet: https://www.alchemy.com/faucets/base-sepolia`
    );
    console.warn(
      `[deploy-nft] CDP UI: https://portal.cdp.coinbase.com/products/faucet (Base Sepolia)`
    );
    console.warn(
      `[deploy-nft] Official list: https://docs.base.org/base-chain/network-information/network-faucets`
    );
    console.warn(`[deploy-nft] Known Polygon deployer (preferred ops EOA): ${POLYGON_DEPLOYER}`);
    console.warn(`[deploy-nft] Smart Wallet recipient only: ${GOVCHAIN_SIGNER}`);
    return;
  }

  const wallet = new ethers.Wallet(key, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`[deploy-nft] opsEOA=${wallet.address} balance=${ethers.formatEther(balance)} ${chain.currency}`);

  if (wallet.address.toLowerCase() === GOVCHAIN_SIGNER.toLowerCase()) {
    throw new Error(
      "This key resolves to the Coinbase Smart Wallet address. ethers.Wallet cannot operate that account. Use the Polygon deployer EOA or a new ops EOA."
    );
  }

  let address = existingContract();
  if (address) {
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
      throw new Error(`GOVCHAIN_NFT_CONTRACT ${address} has no bytecode on ${chain.name}`);
    }
    console.log(`[deploy-nft] using existing ${address}`);
  } else {
    const artifactFile = artifactPath();
    if (!existsSync(artifactFile)) {
      console.warn(
        `[deploy-nft] No artifact at ${artifactFile}. Compile then rerun, or deploy via thirdweb:`
      );
      console.warn(`  npx thirdweb deploy contracts/AuthiChainNFT.sol`);
      console.warn(`  pick Base Sepolia (84532), then set GOVCHAIN_NFT_CONTRACT=<address>`);
      console.warn(
        `  Hardhat sources are currently scoped to contracts/ledger — do not expect npx hardhat compile to emit AuthiChainNFT.`
      );
      return;
    }
    if (balance === 0n) {
      console.warn(`[deploy-nft] ops EOA has 0 ${chain.currency}. Claim faucet then rerun.`);
      console.warn(`  https://www.alchemy.com/faucets/base-sepolia`);
      console.warn(`  https://portal.cdp.coinbase.com/products/faucet`);
      return;
    }
    if (DRY_RUN) {
      console.log(`[deploy-nft] DRY_RUN would deploy AuthiChainNFT from ${artifactFile}`);
      return;
    }
    const artifact = JSON.parse(readFileSync(artifactFile, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    address = await contract.getAddress();
    const tx = contract.deploymentTransaction();
    console.log(`[deploy-nft] deployed ${address} tx=${tx?.hash}`);
    console.log(`[deploy-nft] explorer ${chain.explorer}/address/${address}`);
  }

  if (!address) return;

  const nft = new ethers.Contract(address, ROLE_ABI, wallet);
  await grantIfNeeded(nft, wallet.address, "opsEOA", DRY_RUN);
  if (GRANT_SMART_WALLET) {
    await grantIfNeeded(nft, GOVCHAIN_SIGNER, "smartWallet", DRY_RUN);
  } else {
    console.log(
      `[deploy-nft] skip Smart Wallet grant (set GRANT_SMART_WALLET=true to verifyManufacturer(${GOVCHAIN_SIGNER}))`
    );
  }

  const outDir = join(process.cwd(), "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `AuthiChainNFT.${chain.key}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        contract: "AuthiChainNFT",
        address,
        chainId: chain.chainId,
        network: chain.key,
        opsEOA: wallet.address,
        smartWallet: GOVCHAIN_SIGNER,
        grantedSmartWallet: GRANT_SMART_WALLET,
        dryRun: DRY_RUN,
        writtenAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`[deploy-nft] wrote ${outFile}`);
  console.log("");
  console.log("Next secrets:");
  console.log(`  CHAIN=${chain.key}`);
  console.log(`  GOVCHAIN_NFT_CONTRACT=${address}`);
  console.log(`  WALLET_PRIVATE_KEY=<ops EOA, same as this run>`);
  console.log(`  DRY_RUN=true pnpm exec tsx scripts/mint-govchain-nfts.ts`);
}

main().catch((err) => {
  console.error("[deploy-nft] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
