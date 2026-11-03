import assert from "node:assert/strict";
import { test } from "node:test";
import { matchPendingFacilitatorReceipt } from "./facilitator-match.mjs";

const tx = `0x${"a".repeat(64)}`;
const another = `0x${"b".repeat(64)}`;
const candidate = { txHash: tx, amountCents: 5, network: "eip155:8453", wallet: "0xBuyer", createdAt: "2026-11-01T09:20:11Z" };
const pending = { amountCents: 5, network: "eip155:8453", wallet: "0xbuyer", metadata: { x402: "1", facilitatorTxHint: tx } };

test("exact facilitator transaction reference matches", () => {
  assert.equal(matchPendingFacilitatorReceipt(pending, [candidate]), candidate);
});
test("case-insensitive hash and wallet comparison", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, metadata: { facilitatorTxHint: tx.toUpperCase().replace("0X", "0x") } }, [candidate]), candidate);
});
test("same amount and time with no facilitator hash stays pending", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, metadata: { x402: "1" } }, [candidate]), null);
});
test("invalid or partial transaction hint is rejected", () => {
  for (const facilitatorTxHint of ["", "0xabc", "0x" + "z".repeat(64), null]) {
    assert.equal(matchPendingFacilitatorReceipt({ ...pending, metadata: { facilitatorTxHint } }, [candidate]), null);
  }
});
test("different on-chain transaction cannot be matched by amount/time", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, metadata: { facilitatorTxHint: another } }, [candidate]), null);
});
test("amount mismatch fails closed", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, amountCents: 10 }, [candidate]), null);
});
test("network mismatch fails closed", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, network: "eip155:84532" }, [candidate]), null);
});
test("payer mismatch fails closed", () => {
  assert.equal(matchPendingFacilitatorReceipt({ ...pending, wallet: "0xOther" }, [candidate]), null);
});
test("candidate missing hash fails closed", () => {
  assert.equal(matchPendingFacilitatorReceipt(pending, [{ ...candidate, txHash: undefined }]), null);
});
