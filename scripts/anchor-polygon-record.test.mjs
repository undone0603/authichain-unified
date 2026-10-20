import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  anchorSpendAllowed,
  GAS_LIMIT,
  POL_RESERVE,
  TX_SPEND_CAP,
} from "./anchor-polygon-record.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("anchorSpendAllowed keeps 0.10 POL after a fee inside the 0.05 cap", () => {
  const maxFeePerGas = 1_000_000_000_000n;
  const cost = maxFeePerGas * GAS_LIMIT;
  assert.equal(cost < TX_SPEND_CAP, true);
  const exact = anchorSpendAllowed({ balance: cost + POL_RESERVE, maxFeePerGas });
  assert.deepEqual(exact, { allowed: true, reason: null });
  const short = anchorSpendAllowed({ balance: cost + POL_RESERVE - 1n, maxFeePerGas });
  assert.deepEqual(short, { allowed: false, reason: "reserve" });
  const dust = anchorSpendAllowed({ balance: 20_000_000_000_000_000n, maxFeePerGas: 1n });
  assert.equal(dust.allowed, false);
  assert.equal(dust.reason, "reserve");
});

test("anchorSpendAllowed refuses a fee over 0.05 POL and a gas limit other than 30000", () => {
  const overFee = 1_666_666_666_666_667n;
  assert.equal(overFee * GAS_LIMIT > TX_SPEND_CAP, true);
  const capped = anchorSpendAllowed({
    balance: overFee * GAS_LIMIT + POL_RESERVE,
    maxFeePerGas: overFee,
  });
  assert.deepEqual(capped, { allowed: false, reason: "over_spend_cap" });
  const gas = anchorSpendAllowed({
    balance: POL_RESERVE + 30_001n,
    maxFeePerGas: 1n,
    gasLimit: 30_001n,
  });
  assert.deepEqual(gas, { allowed: false, reason: "gas_limit" });
  assert.deepEqual(anchorSpendAllowed({ balance: 1, maxFeePerGas: 1n }), {
    allowed: false,
    reason: "spend_inputs_invalid",
  });
});

test("the anchor script does not broadcast, and a self-transfer stays wrong_contract", () => {
  const src = readFileSync(join(here, "anchor-polygon-record.mjs"), "utf8");
  assert.equal(src.includes("MIN_POL"), false);
  assert.equal(src.includes("0.01"), false);
  assert.equal(src.includes("0x4da4"), false);
  assert.equal(src.includes("SEND = \"true\""), false);
  assert.equal(src.includes("process.env.SEND === \"true\""), true);
  assert.equal(src.includes("to: wallet.address"), true);
  assert.equal(src.includes("anchorSpendAllowed"), true);
  const api = readFileSync(join(here, "../workers/authichain-api/index.js"), "utf8");
  assert.equal(api.includes("wrong_contract"), true);
  assert.equal(api.includes("0x4da4D2675e52374639C9c954f4f653887A9972BE"), true);
  assert.equal(api.includes("function anchorContracts()"), true);
});
