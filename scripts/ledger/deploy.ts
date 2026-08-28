/**
 * scripts/ledger/deploy.ts
 *
 * Deploys AuthiChainLedger.
 *
 *   npx hardhat run scripts/ledger/deploy.ts --network amoy
 *   npx hardhat run scripts/ledger/deploy.ts --network polygon
 *
 * Refuses to run without a signer key. Nothing is deployed by CI or by the
 * build — this is a manual, explicit step.
 */

import { ethers, network, run } from "hardhat";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

async function main() {
  const key = (process.env.MINTER_PRIVATE_KEY || process.env.THIRDWEB_MINTER_KEY || "").trim();
  if (!key) {
    console.error(
      "Refusing to deploy: neither MINTER_PRIVATE_KEY nor THIRDWEB_MINTER_KEY is set."
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`network   : ${network.name} (chainId ${chainId})`);
  console.log(`deployer  : ${deployer.address}`);
  console.log(`balance   : ${ethers.formatEther(balance)} POL`);

  if (balance === 0n) {
    console.error("Refusing to deploy: deployer has zero balance.");
    process.exit(1);
  }

  const factory = await ethers.getContractFactory("AuthiChainLedger");
  const ledger = await factory.deploy(deployer.address);
  await ledger.waitForDeployment();

  const address = await ledger.getAddress();
  const tx = ledger.deploymentTransaction();

  console.log("");
  console.log(`AuthiChainLedger deployed: ${address}`);
  console.log(`deploy tx                : ${tx?.hash ?? "n/a"}`);
  console.log(`recorder (owner)         : ${deployer.address}`);

  // Optional second recorder, e.g. a dedicated webhook signer distinct from
  // the NFT minter. Skipped unless explicitly set.
  const extraRecorder = process.env.LEDGER_EXTRA_RECORDER?.trim();
  if (extraRecorder && ethers.isAddress(extraRecorder)) {
    const rtx = await ledger.setRecorder(ethers.getAddress(extraRecorder), true);
    await rtx.wait();
    console.log(`extra recorder granted   : ${extraRecorder}`);
  }

  const outDir = join(process.cwd(), "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `AuthiChainLedger.${network.name}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        contract: "AuthiChainLedger",
        address,
        chainId,
        network: network.name,
        owner: deployer.address,
        deployTx: tx?.hash ?? null,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`written                  : ${outFile}`);

  console.log("");
  console.log("Next:");
  console.log(`  1. set LEDGER_CONTRACT_ADDRESS=${address}`);
  console.log(`  2. set LEDGER_CHAIN_ID=${chainId}`);
  console.log(
    `  3. npx hardhat verify --network ${network.name} ${address} ${deployer.address}`
  );

  if (process.env.LEDGER_AUTO_VERIFY === "true") {
    console.log("\nverifying...");
    try {
      await tx?.wait(5);
      await run("verify:verify", { address, constructorArguments: [deployer.address] });
    } catch (err) {
      console.warn("verify skipped:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
