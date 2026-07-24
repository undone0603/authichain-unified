/**
 * Staking DB unit tests — all DB calls are mocked. db is now an explicit
 * first parameter (Task 2b-5 migration off the getDb() singleton), so tests
 * pass a mockDb object directly instead of mocking getDb().
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../drizzle/schema.js", () => ({
  stakingPositions: { id: "id", userId: "userId", status: "status", createdAt: "createdAt" },
  platformFees: {},
  transactions: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...args) => ({ op: "and", args })),
  desc: vi.fn((col) => ({ col, dir: "desc" })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  };
  // Allow chaining: from().where().orderBy() and from().where().limit()
  chain.from.mockImplementation(() => ({
    where: vi.fn().mockImplementation(() => ({
      orderBy: vi.fn().mockResolvedValue(rows),
      limit: vi.fn().mockResolvedValue(rows),
      then: (resolve: any) => Promise.resolve(rows).then(resolve),
    })),
    orderBy: vi.fn().mockResolvedValue(rows),
  }));
  mockDb.select.mockReturnValue(chain);
  return chain;
}

function makeInsertChain(returnedRow = { id: 1 }) {
  const chain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    }),
  };
  mockDb.insert.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDb.update.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getUserStakingPositions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries staking positions for the given userId", async () => {
    const rows = [{ id: 1, userId: 42, amount: "100", status: "active" }];
    makeSelectChain(rows);
    const { getUserStakingPositions } = await import("./db.js");
    const result = await getUserStakingPositions(mockDb as any, 42);
    expect(result).toEqual(rows);
    expect(mockDb.select).toHaveBeenCalledOnce();
  });
});

describe("createStakingPosition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts with stringified amount and apy and rewardsEarned=0", async () => {
    const { values } = makeInsertChain();
    const { createStakingPosition } = await import("./db.js");
    await createStakingPosition(mockDb as any, { userId: 5, amount: 250, apy: 800 });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "250", apy: "800", rewardsEarned: "0", status: "active" }),
    );
  });
});

describe("getUserStakingStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums only active positions for totalStaked", async () => {
    const rows = [
      { id: 1, userId: 1, amount: "500", status: "active" },
      { id: 2, userId: 1, amount: "200", status: "withdrawn" },
      { id: 3, userId: 1, amount: "300", status: "active" },
    ];
    makeSelectChain(rows);
    const { getUserStakingStats } = await import("./db.js");
    const stats = await getUserStakingStats(mockDb as any, 1);
    expect(stats.totalStaked).toBe(800);
    expect(stats.activePositions).toBe(2);
    expect(stats.totalPositions).toBe(3);
  });
});

describe("calculateRewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when position is not found", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(chain);
    const { calculateRewards } = await import("./db.js");
    await expect(calculateRewards(mockDb as any, 999)).rejects.toThrow("Staking position not found");
  });

  it("returns 0 for non-active positions", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 1, status: "withdrawn", amount: "100", apy: "1200", rewardsEarned: "0", lastRewardCalculation: new Date(), stakedAt: new Date() },
      ]),
    };
    mockDb.select.mockReturnValue(chain);
    const { calculateRewards } = await import("./db.js");
    expect(await calculateRewards(mockDb as any, 1)).toBe(0);
  });
});

describe("createTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts with stringified amount", async () => {
    const { values } = makeInsertChain();
    const { createTransaction } = await import("./db.js");
    await createTransaction(mockDb as any, { userId: 1, type: "stake", amount: 100, status: "completed" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "100", type: "stake", status: "completed" }),
    );
  });
});
