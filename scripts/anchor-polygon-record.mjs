/**
 * Put the demonstration record's SHA-256 into one Polygon mainnet transaction.
 * Prints the address and the tx hash. Never prints the private key.
 *
 * SEND=true broadcasts. Anything else only reports the address and POL balance.
 * A broadcast also requires anchorSpendAllowed: gas limit 30000, max fee at
 * most 0.05 POL, and at least 0.10 POL remaining after that fee.
 * This file does not set SEND.
 */
import { pathToFileURL } from "node:url";

export const GAS_LIMIT = 30_000n;
export const TX_SPEND_CAP = 50_000_000_000_000_000n; // 0.05 POL
export const POL_RESERVE = 100_000_000_000_000_000n; // 0.10 POL

/** Pure spend guard. It does not broadcast and it does not read a key. */
export function anchorSpendAllowed({ balance, maxFeePerGas, gasLimit = GAS_LIMIT } = {}) {
  if (typeof balance !== "bigint" || typeof maxFeePerGas !== "bigint" || typeof gasLimit !== "bigint") {
    return { allowed: false, reason: "spend_inputs_invalid" };
  }
  if (balance < 0n || maxFeePerGas < 0n) {
    return { allowed: false, reason: "spend_inputs_invalid" };
  }
  if (gasLimit !== GAS_LIMIT) return { allowed: false, reason: "gas_limit" };
  const cost = maxFeePerGas * gasLimit;
  if (cost > TX_SPEND_CAP) return { allowed: false, reason: "over_spend_cap" };
  if (balance - cost < POL_RESERVE) return { allowed: false, reason: "reserve" };
  return { allowed: true, reason: null };
}

async function main() {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { JsonRpcProvider, Wallet } = await import("ethers");
  const { signingBytes } = await import("../protocol/verifier.mjs");

  const RECORD_PATH = "protocol/examples/polygon-anchor-1.record.json";
  const RPC = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";

  const record = JSON.parse(readFileSync(RECORD_PATH, "utf8"));
  const hash = createHash("sha256").update(signingBytes(record)).digest("hex");
  const expected = readFileSync("protocol/examples/polygon-anchor-1.hash.txt", "utf8").trim();
  if (hash !== expected) {
    console.error("record hash does not match polygon-anchor-1.hash.txt");
    process.exit(1);
  }

  const key = process.env.WALLET_PRIVATE_KEY || process.env.POLYGON_PRIVATE_KEY || "";
  if (!key) {
    console.error("no WALLET_PRIVATE_KEY or POLYGON_PRIVATE_KEY");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC, 137, { staticNetwork: true });
  const wallet = new Wallet(key, provider);
  const balance = await provider.getBalance(wallet.address);
  const latestNonce = await provider.getTransactionCount(wallet.address, "latest");
  const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log(JSON.stringify({
    address: wallet.address,
    balancePol: Number(balance) / 1e18,
    recordHash: hash,
    send: process.env.SEND === "true",
    latestNonce,
    pendingNonce,
  }));

  if (process.env.SEND !== "true") process.exit(0);

  const block = await provider.getBlock("latest");
  const base = block?.baseFeePerGas ?? 30_000_000_000n;
  const tip = 50_000_000_000n;
  const maxFee = base * 3n + tip;
  const gasLimit = GAS_LIMIT;
  const spend = anchorSpendAllowed({ balance, maxFeePerGas: maxFee, gasLimit });
  if (!spend.allowed) {
    console.error(JSON.stringify({
      error: spend.reason,
      baseGwei: Number(base) / 1e9,
    }));
    process.exit(2);
  }

  // A stuck underpriced tx holds latestNonce. Replacing it is the same nonce.
  const nonce = latestNonce;
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    data: "0x" + hash,
    value: 0n,
    nonce,
    gasLimit,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: tip,
  });
  console.log(JSON.stringify({
    sent: tx.hash,
    nonce,
    maxFeeGwei: Number(maxFee) / 1e9,
    baseGwei: Number(base) / 1e9,
  }));
  const receipt = await Promise.race([
    tx.wait(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("receipt timeout")), 90_000)),
  ]);
  console.log(JSON.stringify({
    txHash: receipt.hash,
    status: receipt.status,
    blockNumber: receipt.blockNumber,
  }));
  if (receipt.status !== 1) process.exit(1);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) await main();
