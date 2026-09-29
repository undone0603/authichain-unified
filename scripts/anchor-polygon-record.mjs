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

const provider = new JsonRpcProvider(RPC, 137);
const wallet = new Wallet(key, provider);
const balance = await provider.getBalance(wallet.address);
console.log(JSON.stringify({
  address: wallet.address,
  balancePol: Number(balance) / 1e18,
  recordHash: hash,
  send: process.env.SEND === "true",
}));

if (process.env.SEND !== "true") process.exit(0);
if (balance < MIN_POL) {
  console.error("balance under 0.01 POL; not sending");
  process.exit(2);
}

const tx = await wallet.sendTransaction({
  to: wallet.address,
  data: "0x" + hash,
  value: 0n,
  gasLimit: 30_000n,
  maxFeePerGas: 200_000_000_000n,
  maxPriorityFeePerGas: 30_000_000_000n,
});
console.log(JSON.stringify({ sent: tx.hash }));
const receipt = await tx.wait();
console.log(JSON.stringify({
  txHash: receipt.hash,
  status: receipt.status,
  blockNumber: receipt.blockNumber,
}));
if (receipt.status !== 1) process.exit(1);
