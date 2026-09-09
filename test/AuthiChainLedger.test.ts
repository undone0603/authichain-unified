/**
 * test/AuthiChainLedger.test.ts
 *
 * Uses node:assert rather than chai so it runs with a bare `hardhat` +
 * `@nomicfoundation/hardhat-ethers` install, no toolbox required.
 *
 *   npx hardhat test test/AuthiChainLedger.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";

const { ethers } = await hre.network.getOrCreate();

const refOf = (id: string) => ethers.keccak256(ethers.toUtf8Bytes(id));
const sku = (s: string) => ethers.encodeBytes32String(s);

const REF = refOf("cs_live_a1b2c3");

async function deploy() {
  const [owner, webhook, stranger] = await ethers.getSigners();
  const ledger = await (await ethers.getContractFactory("AuthiChainLedger")).deploy(owner.address);
  await ledger.waitForDeployment();
  return { ledger, owner, webhook, stranger };
}

describe("AuthiChainLedger", () => {
  it("starts empty and treats saleId 0 as not-found", async () => {
    const { ledger } = await deploy();
    assert.equal(await ledger.totalSales(), 0n);
    assert.equal(await ledger.saleIdByRef(REF), 0n);
    assert.equal(await ledger.isAnchored(REF), false);

    const sentinel = await ledger.saleByStripeRef(refOf("cs_never"));
    assert.equal(sentinel.stripeRef, ethers.ZeroHash);
    assert.equal(sentinel.amountCents, 0n);
  });

  it("records a sale and emits SaleRecorded", async () => {
    const { ledger } = await deploy();
    const tx = await ledger.recordSale(REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1756200000n);
    const rc = await tx.wait();

    const evt = rc!.logs
      .map((l) => {
        try {
          return ledger.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "SaleRecorded");

    assert.ok(evt, "SaleRecorded not emitted");
    assert.equal(evt!.args[0], 1n); // saleId
    assert.equal(evt!.args[1], REF); // stripeRef
    assert.equal(evt!.args[3], 4900n); // amountCents
    assert.equal(evt!.args[4], 0n); // source = live

    const sale = await ledger.saleByStripeRef(REF);
    assert.equal(ethers.decodeBytes32String(sale.sku), "truemark-pro");
    assert.equal(sale.stripeCreated, 1756200000n);
    assert.equal(sale.reversed, false);
    assert.ok(sale.anchoredAt > 0n);
  });

  it("does not double-anchor a replayed webhook", async () => {
    const { ledger } = await deploy();
    await (await ledger.recordSale(REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1756200000n)).wait();

    // Second delivery of the same Stripe event.
    const returned = await ledger.recordSale.staticCall(
      REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1756200000n
    );
    assert.equal(returned, 1n, "duplicate must return the existing saleId");

    await (await ledger.recordSale(REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1756200000n)).wait();
    assert.equal(await ledger.totalSales(), 1n, "duplicate must not create a second sale");
  });

  it("gates writes behind the recorder role", async () => {
    const { ledger, webhook, stranger } = await deploy();

    await assert.rejects(
      ledger.connect(stranger).recordSale(refOf("cs_x"), sku("a"), 1n, 0, ethers.ZeroAddress, 0, 1n),
      /NotRecorder/
    );

    await (await ledger.setRecorder(webhook.address, true)).wait();
    await (await ledger.connect(webhook).recordSale(refOf("in_renew_1"), sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1n)).wait();
    assert.equal(await ledger.totalSales(), 1n);

    await (await ledger.setRecorder(webhook.address, false)).wait();
    await assert.rejects(
      ledger.connect(webhook).recordSale(refOf("in_renew_2"), sku("a"), 1n, 0, ethers.ZeroAddress, 0, 1n),
      /NotRecorder/
    );
  });

  it("reverses idempotently and rejects unknown refs", async () => {
    const { ledger } = await deploy();
    await (await ledger.recordSale(REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1n)).wait();

    await (await ledger.recordReversal(REF)).wait();
    assert.equal((await ledger.saleByStripeRef(REF)).reversed, true);

    await (await ledger.recordReversal(REF)).wait(); // no-op
    assert.equal((await ledger.saleByStripeRef(REF)).reversed, true);

    await assert.rejects(ledger.recordReversal(refOf("cs_never")), /UnknownSale/);
  });

  it("batches backfill and reuses ids for refs already anchored", async () => {
    const { ledger } = await deploy();
    await (await ledger.recordSale(REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 0, 1n)).wait();

    const inputs = [
      [refOf("cs_bf_1"), sku("qron-credits"), 1500n, 0, ethers.ZeroAddress, 1, 1740000000n],
      [refOf("cs_bf_2"), sku("qron-credits"), 2500n, 0, ethers.ZeroAddress, 1, 1740000100n],
      [REF, sku("truemark-pro"), 4900n, 0, ethers.ZeroAddress, 1, 1n], // already live-anchored
    ];

    const ids = await ledger.recordSaleBatch.staticCall(inputs);
    await (await ledger.recordSaleBatch(inputs)).wait();

    assert.deepEqual(ids.map(String), ["2", "3", "1"]);
    assert.equal(await ledger.totalSales(), 3n);

    // A backfill pass must never overwrite the live provenance of an existing sale.
    assert.equal((await ledger.saleByStripeRef(REF)).source, 0n);
  });
});
