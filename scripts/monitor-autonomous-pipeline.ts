#!/usr/bin/env tsx

import "dotenv/config";
import {
  formatPipelineSnapshot,
  getPipelineSnapshot,
} from "../server/monitoring/pipeline-monitor.js";

const intervalArg = process.argv
  .slice(2)
  .find(arg => arg.startsWith("--interval="))
  ?.split("=")[1];
const once = process.argv.includes("--once");
const intervalMs = intervalArg ? Number(intervalArg) : 5_000;

if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000) {
  console.error("--interval must be an integer of at least 1000 milliseconds");
  process.exit(2);
}

console.log("AuthiChain pipeline task monitor (live database snapshot)");
console.log(`Polling every ${intervalMs}ms. Press Ctrl+C to stop.\n`);

let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
  console.log("\nMonitor stopped.");
});

async function poll(): Promise<void> {
  try {
    const snapshot = await getPipelineSnapshot();
    console.log(`\n${formatPipelineSnapshot(snapshot)}`);
  } catch (error) {
    console.error(
      "Could not read pipeline task metrics:",
      error instanceof Error ? error.message : error
    );
    if (once) process.exitCode = 1;
  }

  if (!stopped && !once) setTimeout(poll, intervalMs);
}

void poll();
