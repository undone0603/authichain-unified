/**
 * Put the demonstration record's SHA-256 into one Polygon mainnet transaction.
 * Prints the address and the tx hash. Never prints the private key.
 *
 * SEND=true broadcasts. Anything else only reports the address and POL balance.
 * Refuses to send if the balance is under 0.01 POL.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JsonRpcProvider, Wallet } from "ethers";
import { signingBytes } from "../protocol/verifier.mjs";

const RECORD_PATH = "protocol/examples/polygon-anchor-1.record.json";
const MIN_POL = 10_000_000_000_000_000n; // 0.01 POL
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
if (balance < MIN_POL) {
  console.error("balance under 0.01 POL; not sending");
  process.exit(2);
}

const block = await provider.getBlock("latest");
const base = block?.baseFeePerGas ?? 30_000_000_000n;
const tip = 50_000_000_000n;
let maxFee = base * 3n + tip;
const gasLimit = 30_000n;
const spendCap = 50_000_000_000_000_000n; // 0.05 POL
if (maxFee * gasLimit > spendCap) {
  console.error(JSON.stringify({
    error: "base fee would cost more than 0.05 POL",
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
