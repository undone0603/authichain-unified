// scripts/deploy-authichain-nft-base.ts
// Deploy AuthiChainNFT to Base / Base Sepolia / Polygon OR grant roles on an existing deploy.
//
// Why this is not `grantRole(MINTER_ROLE)` alone:
//   mintProduct also requires msg.sender to be a verified manufacturer
//   OR hold DEFAULT_ADMIN_ROLE. verifyManufacturer() sets both.
//
// The Coinbase Smart Wallet (0xC0D26735…) cannot sign with ethers.Wallet.
// Deploy + mint from the NFT deployer EOA. Optionally verifyManufacturer(Smart Wallet)
// so a human can mint from Coinbase Wallet later.
//
// Env (never log secret values):
//   CHAIN                 base (default) | base-sepolia | polygon | polygon-amoy
//   DRY_RUN               anything except "false" is a dry run (default dry)
//   GRANT_SMART_WALLET    "true" to also verifyManufacturer(GOVCHAIN_SIGNER)
//   ARTIFACT_PATH         override compiled AuthiChainNFT.json
//   GOVCHAIN_NFT_CONTRACT / CONTRACT_ADDRESS  — skip deploy, grant only when getCode != 0x.
//                                               Empty bytecode is treated as unset (stale secret).
//   WALLET_PRIVATE_KEY | MINTER_PRIVATE_KEY | POLYGON_PRIVATE_KEY  (NFT deployer EOA)
//   ALCHEMY_API_KEY       optional; falls back to the chain public RPC
//
// Do not use the payTo / tokenomics EOA (0xaebf…e437) or the $QRON
// holder EOA (0x5db5…) as this signer.
// Identity: docs/strategy/WEB3_IDENTITY.md.
//
// Usage:
//   node scripts/compile-authichain-nft.cjs
//   CHAIN=base DRY_RUN=true  GRANT_SMART_WALLET=true pnpm exec tsx scripts/deploy-authichain-nft-base.ts
//   CHAIN=base DRY_RUN=false GRANT_SMART_WALLET=true pnpm exec tsx scripts/deploy-authichain-nft-base.ts

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import {
  defaultArtifactPath,
  isEmptyBytecode,
  loadAuthiChainNftArtifact,
  bytecodeByteLength,
} from "./lib/authichain-nft-artifact.js";
import {
  GOVCHAIN_SIGNER,
  POLYGON_DEPLOYER,
  resolveChain,
  rpcUrl,
} from "./lib/evm-chains.js";

const DRY_RUN = process.env.DRY_RUN !== "false";
const GRANT_SMART_WALLET = process.env.GRANT_SMART_WALLET === "true";
const IN_ACTIONS = process.env.GITHUB_ACTIONS === "true";

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

function fail(message: string): never {
  throw new Error(message);
}

function writeGithubOutput(fields: Record<string, string>) {
  const dest = process.env.GITHUB_OUTPUT;
  if (!dest) return;
  const lines = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
  appendFileSync(dest, `${lines.join("\n")}\n`);
}

async function requireCode(
  provider: ethers.JsonRpcProvider,
  address: string,
  label: string
): Promise<string> {
  const code = await provider.getCode(address);
  if (isEmptyBytecode(code)) {
    fail(`${label} ${address} has no bytecode (getCode=0x)`);
  }
  return code;
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

function writeReceipt(payload: Record<string, unknown>, chainKey: string): string {
  const outDir = join(process.cwd(), "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `AuthiChainNFT.${chainKey}.json`);
  writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`[deploy-nft] wrote ${outFile}`);
  return outFile;
}

async function main() {
  const chain = resolveChain();
  const key = privateKey();
  const artifactFile = defaultArtifactPath();
  const existing = existingContract();

  console.log(`[deploy-nft] chain=${chain.name} (${chain.chainId}) dryRun=${DRY_RUN}`);
  console.log(
    `[deploy-nft] env CHAIN DRY_RUN GRANT_SMART_WALLET ARTIFACT_PATH GOVCHAIN_NFT_CONTRACT`
  );
  console.log(
    `[deploy-nft] secrets expected: WALLET_PRIVATE_KEY|POLYGON_PRIVATE_KEY (NFT deployer EOA), ALCHEMY_API_KEY optional`
  );
  console.log(
    `[deploy-nft] hasOpsKey=${Boolean(key)} hasAlchemy=${Boolean(process.env.ALCHEMY_API_KEY)} existing=${existing || "none"} artifact=${artifactFile}`
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl(chain));
  const network = await provider.getNetwork();
  console.log(`[deploy-nft] rpc chainId=${Number(network.chainId)}`);
  if (Number(network.chainId) !== chain.chainId) {
    fail(`RPC chainId ${network.chainId} != expected ${chain.chainId}`);
  }

  if (!key) {
    const hint =
      `[deploy-nft] No NFT deployer key. Set WALLET_PRIVATE_KEY or POLYGON_PRIVATE_KEY (NOT the Coinbase Smart Wallet, NOT the payTo / tokenomics EOA). ` +
      `Known NFT deployer EOA: ${POLYGON_DEPLOYER}. Smart Wallet recipient only: ${GOVCHAIN_SIGNER}.`;
    if (!DRY_RUN) fail(hint);
    console.warn(hint);
    if (IN_ACTIONS && !existing) {
      console.warn("[deploy-nft] DRY_RUN without a key: compile + RPC + artifact checks only");
    }
  }

  let wallet: ethers.Wallet | null = null;
  let balance = 0n;
  if (key) {
    wallet = new ethers.Wallet(key, provider);
    if (wallet.address.toLowerCase() === GOVCHAIN_SIGNER.toLowerCase()) {
      fail(
        "This key resolves to the Coinbase Smart Wallet address. ethers.Wallet cannot operate that account. Use the NFT deployer EOA (POLYGON_DEPLOYER / WALLET_PRIVATE_KEY)."
      );
    }
    balance = await provider.getBalance(wallet.address);
    console.log(
      `[deploy-nft] nftDeployerEOA=${wallet.address} balance=${ethers.formatEther(balance)} ${chain.currency}`
    );
  }

  let address = existing;
  if (address) {
    const code = await provider.getCode(address);
    if (isEmptyBytecode(code)) {
      console.warn(
        `[deploy-nft] GOVCHAIN_NFT_CONTRACT ${address} has no bytecode on ${chain.name} (getCode=0x). ` +
          `Secret is stale or a placeholder — ignoring it and deploying fresh.`
      );
      address = "";
    } else {
      console.log(
        `[deploy-nft] using existing ${address} getCode_bytes=${bytecodeByteLength(code)} ${chain.explorer}/address/${address}`
      );
    }
  }

  if (!DRY_RUN && !address && wallet && balance === 0n) {
    fail(`NFT deployer EOA ${wallet.address} has 0 ${chain.currency} on ${chain.name}; fund it before a live deploy`);
  }

  let deployTxHash = "";
  let artifactBytes = 0;
  if (!address) {
    const artifact = loadAuthiChainNftArtifact(artifactFile);
    artifactBytes = bytecodeByteLength(artifact.bytecode);
    console.log(`[deploy-nft] artifact ${artifactFile} bytecode_bytes=${artifactBytes} abi=${artifact.abi.length}`);

    if (!wallet) {
      writeReceipt(
        {
          contract: "AuthiChainNFT",
          address: null,
          chainId: chain.chainId,
          network: chain.key,
          nftDeployerEOA: null,
          smartWallet: GOVCHAIN_SIGNER,
          grantedSmartWallet: GRANT_SMART_WALLET,
          dryRun: DRY_RUN,
          artifactPath: artifactFile,
          bytecodeBytes: artifactBytes,
          writtenAt: new Date().toISOString(),
        },
        chain.key
      );
      writeGithubOutput({
        contract_address: "",
        dry_run: String(DRY_RUN),
        chain: chain.key,
        explorer: "",
      });
      if (!DRY_RUN) fail("Live deploy requires WALLET_PRIVATE_KEY or POLYGON_PRIVATE_KEY");
      console.log("[deploy-nft] DRY_RUN would deploy AuthiChainNFT (no ops key in this process)");
      return;
    }

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    if (DRY_RUN) {
      try {
        const deployTx = await factory.getDeployTransaction();
        const gas = await provider.estimateGas({ ...deployTx, from: wallet.address });
        console.log(`[deploy-nft] DRY_RUN estimated deploy gas=${gas.toString()}`);
      } catch (err) {
        console.warn(
          `[deploy-nft] DRY_RUN could not estimate gas: ${err instanceof Error ? err.message : err}`
        );
      }
      console.log(`[deploy-nft] DRY_RUN would deploy AuthiChainNFT from ${artifactFile}`);
      writeReceipt(
        {
          contract: "AuthiChainNFT",
          address: null,
          chainId: chain.chainId,
          network: chain.key,
          nftDeployerEOA: wallet.address,
          smartWallet: GOVCHAIN_SIGNER,
          grantedSmartWallet: GRANT_SMART_WALLET,
          dryRun: true,
          artifactPath: artifactFile,
          bytecodeBytes: artifactBytes,
          writtenAt: new Date().toISOString(),
        },
        chain.key
      );
      writeGithubOutput({
        contract_address: "",
        dry_run: "true",
        chain: chain.key,
        explorer: "",
      });
      return;
    }

    const contract = await factory.deploy();
    await contract.waitForDeployment();
    address = await contract.getAddress();
    const tx = contract.deploymentTransaction();
    deployTxHash = tx?.hash || "";
    console.log(`[deploy-nft] deployed ${address} tx=${deployTxHash}`);
    console.log(`[deploy-nft] explorer ${chain.explorer}/address/${address}`);
    const code = await requireCode(provider, address, "fresh AuthiChainNFT deploy");
    console.log(
      `[deploy-nft] getCode_bytes=${bytecodeByteLength(code)} ${chain.explorer}/address/${address}`
    );
  }

  if (!wallet) {
    if (!DRY_RUN) fail("Grant/live path requires WALLET_PRIVATE_KEY or POLYGON_PRIVATE_KEY");
    writeReceipt(
      {
        contract: "AuthiChainNFT",
        address,
        chainId: chain.chainId,
        network: chain.key,
        nftDeployerEOA: null,
        smartWallet: GOVCHAIN_SIGNER,
        grantedSmartWallet: GRANT_SMART_WALLET,
        dryRun: DRY_RUN,
        writtenAt: new Date().toISOString(),
      },
      chain.key
    );
    writeGithubOutput({
      contract_address: address,
      dry_run: String(DRY_RUN),
      chain: chain.key,
      explorer: `${chain.explorer}/address/${address}`,
    });
    return;
  }

  const nft = new ethers.Contract(address, ROLE_ABI, wallet);
  await grantIfNeeded(nft, wallet.address, "nftDeployerEOA", DRY_RUN);
  if (GRANT_SMART_WALLET) {
    await grantIfNeeded(nft, GOVCHAIN_SIGNER, "smartWallet", DRY_RUN);
  } else {
    console.log(
      `[deploy-nft] skip Smart Wallet grant (set GRANT_SMART_WALLET=true to verifyManufacturer(${GOVCHAIN_SIGNER}))`
    );
  }

  const receiptPath = writeReceipt(
    {
      contract: "AuthiChainNFT",
      address,
      chainId: chain.chainId,
      network: chain.key,
      nftDeployerEOA: wallet.address,
      smartWallet: GOVCHAIN_SIGNER,
      grantedSmartWallet: GRANT_SMART_WALLET,
      dryRun: DRY_RUN,
      deployTx: deployTxHash || null,
      explorer: `${chain.explorer}/address/${address}`,
      writtenAt: new Date().toISOString(),
    },
    chain.key
  );

  writeGithubOutput({
    contract_address: address,
    dry_run: String(DRY_RUN),
    chain: chain.key,
    explorer: `${chain.explorer}/address/${address}`,
    receipt: receiptPath,
  });

  console.log("");
  console.log("Next secrets:");
  console.log(`  CHAIN=${chain.key}`);
  console.log(`  GOVCHAIN_NFT_CONTRACT=${address}`);
  console.log(`  WALLET_PRIVATE_KEY=<NFT deployer EOA, same as this run — do not paste into logs>`);
  console.log(`  DRY_RUN=true pnpm exec tsx scripts/mint-govchain-nfts.ts`);
  if (!DRY_RUN) {
    console.log("");
    console.log("Owner: set GitHub Actions secret GOVCHAIN_NFT_CONTRACT to the address above,");
    console.log("then enable gov-mint.yml (id 304825951) and dispatch with dry_run=true.");
    console.log(`Verify: ${chain.explorer}/address/${address}`);
  }
}

main().catch((err) => {
  console.error("[deploy-nft] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
