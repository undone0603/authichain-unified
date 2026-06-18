import { describe, it, expect, vi, beforeEach } from "vitest";
import { payouts, affiliateCommissions } from "../../drizzle/schema";

// executeApprovedPayouts is the ONLY place real funds move. These tests pin its
// safety gates (kill-switch, caps, per-row execution gating) and the success /
// failure bookkeeping, mocking the DB and both transfer rails so nothing leaves
// the test. The pure policy it builds on is covered separately in policy.test.ts.

const { mockEnv, stripeTransferCreate, twTransfer, twBurn } = vi.hoisted(() => ({
  mockEnv: { payoutsEnabled: true, payoutMaxPerItem: 500, payoutMaxPerRun: 1000 },
  stripeTransferCreate: vi.fn(),
  twTransfer: vi.fn(),
  twBurn: vi.fn(),
}));

vi.mock("../_core/env", () => ({ ENV: mockEnv }));
vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("stripe", () => ({
  // Regular function (not arrow) so `new Stripe(...)` works — arrows aren't constructors.
  default: vi.fn(function () { return { transfers: { create: stripeTransferCreate } }; }),
}));
vi.mock("../thirdweb", () => ({ transferErc20: twTransfer, burnErc20: twBurn }));

import { executeApprovedPayouts } from "./service";
import { getDb } from "../db";

// A chainable drizzle stub. `select().from().where()` resolves to `approvedRows`;
// every `update().set().where()` is recorded and resolves undefined, while also
// exposing `.returning()` (the claim step) returning a non-empty row so the
// payout proceeds past the optimistic-lock guard.
function makeMockDb(approvedRows: unknown[]) {
  const updates: Array<{ table: unknown; set: Record<string, unknown> }> = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(approvedRows)) })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((vals: Record<string, unknown>) => ({
        where: vi.fn(() => {
          updates.push({ table, set: vals });
          const p = Promise.resolve(undefined) as Promise<undefined> & {
            returning: () => Promise<Array<{ id: number }>>;
          };
          p.returning = () => Promise.resolve([{ id: 1 }]);
          return p;
        }),
      })),
    })),
    _updates: updates,
  };
  return db;
}

function approvedRow(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    rail: "stripe_connect",
    amount: "100",
    currency: "usd",
    destination: "acct_1",
    referenceType: "affiliate_commission",
    referenceId: "1",
    idempotencyKey: "affiliate_commission:1",
    status: "approved",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.payoutsEnabled = true;
  mockEnv.payoutMaxPerItem = 500;
  mockEnv.payoutMaxPerRun = 1000;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  stripeTransferCreate.mockResolvedValue({ id: "tr_1" });
  twTransfer.mockResolvedValue({ transactionHash: "0xabc" });
  twBurn.mockResolvedValue({ transactionHash: "0xdef" });
});

describe("executeApprovedPayouts — kill switch", () => {
  it("moves no money and touches no rail when PAYOUTS_ENABLED is false", async () => {
    mockEnv.payoutsEnabled = false;
    const db = makeMockDb([approvedRow()]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const res = await executeApprovedPayouts();

    expect(res).toEqual({ attempted: 0, paid: 0, failed: 0, held: 0, skipped: "PAYOUTS_ENABLED is not true" });
    expect(stripeTransferCreate).not.toHaveBeenCalled();
    expect(twTransfer).not.toHaveBeenCalled();
    // It returns before even reading the queue.
    expect(db.select).not.toHaveBeenCalled();
  });

  it("skips when there is no database", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await executeApprovedPayouts();
    expect(res.skipped).toBe("no database");
    expect(stripeTransferCreate).not.toHaveBeenCalled();
  });
});

describe("executeApprovedPayouts — cap circuit breaker", () => {
  it("holds an approved row that exceeds the per-item cap without paying it", async () => {
    const db = makeMockDb([approvedRow({ amount: "600" })]); // > maxPerItem 500
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const res = await executeApprovedPayouts();

    expect(res.paid).toBe(0);
    expect(res.held).toBe(1);
    expect(stripeTransferCreate).not.toHaveBeenCalled();
    const heldUpdate = db._updates.find(u => u.set.status === "held");
    expect(heldUpdate).toBeTruthy();
    expect(String(heldUpdate?.set.failureReason)).toContain("cap");
  });
});

describe("executeApprovedPayouts — per-row execution gating", () => {
  it("holds an on-chain payout that is missing its destination", async () => {
    const db = makeMockDb([
      approvedRow({ rail: "qron_onchain", destination: null, amount: "10", referenceType: "staking_reward", referenceId: "9", idempotencyKey: "staking_reward:9" }),
    ]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const res = await executeApprovedPayouts();

    expect(res.held).toBe(1);
    expect(res.paid).toBe(0);
    expect(twTransfer).not.toHaveBeenCalled();
    const heldUpdate = db._updates.find(u => u.set.status === "held");
    expect(String(heldUpdate?.set.failureReason)).toContain("destination");
  });
});

describe("executeApprovedPayouts — happy path", () => {
  it("transfers via Stripe, marks the payout paid, and settles the source row", async () => {
    const db = makeMockDb([approvedRow()]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const res = await executeApprovedPayouts();

    expect(res).toMatchObject({ attempted: 1, paid: 1, failed: 0, held: 0 });
    // Stripe transfer in minor units, to the connected account, idempotent.
    expect(stripeTransferCreate).toHaveBeenCalledTimes(1);
    expect(stripeTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000, currency: "usd", destination: "acct_1" }),
      expect.objectContaining({ idempotencyKey: "affiliate_commission:1" }),
    );
    // Row claimed (processing) then marked paid with the tx ref.
    expect(db._updates.some(u => u.set.status === "processing")).toBe(true);
    const paidUpdate = db._updates.find(u => u.set.status === "paid");
    expect(paidUpdate?.set.txRef).toBe("tr_1");
    // Source affiliate commission settled.
    expect(db._updates.some(u => u.table === affiliateCommissions && u.set.status === "paid")).toBe(true);
    // Sanity: the queue-of-record table was the payouts table.
    expect(db._updates.some(u => u.table === payouts)).toBe(true);
  });
});

describe("executeApprovedPayouts — transfer failure", () => {
  it("records a failed payout when the rail throws, and does not crash the run", async () => {
    stripeTransferCreate.mockRejectedValue(new Error("card_declined"));
    const db = makeMockDb([approvedRow()]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const res = await executeApprovedPayouts();

    expect(res).toMatchObject({ attempted: 1, paid: 0, failed: 1, held: 0 });
    const failedUpdate = db._updates.find(u => u.set.status === "failed");
    expect(failedUpdate).toBeTruthy();
    expect(String(failedUpdate?.set.failureReason)).toContain("card_declined");
  });
});
