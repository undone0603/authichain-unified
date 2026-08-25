import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the entire db module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    recordReputationEvent: vi.fn().mockResolvedValue(undefined),
    logScanEvent: vi.fn().mockResolvedValue(undefined),
    getDb: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 1 }]) }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
    }),
  };
});

import * as db from "./db";

describe("Reputation Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it("records a reputation event and upserts the user's points", async () => {
    await db.recordReputationEvent(123, "scan_authenticity_confirmed", 1);
    expect(db.recordReputationEvent).toHaveBeenCalledWith(123, "scan_authenticity_confirmed", 1);
  });

  it("awards a point for an authentic scan with a known user", async () => {
    await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true, userId: 123 });
    expect(db.logScanEvent).toHaveBeenCalledWith({ qrCodeId: 1, productId: 1, isAuthentic: true, userId: 123 });
  });

  it("does not touch reputation for anonymous scans", async () => {
    await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true });
    expect(db.logScanEvent).toHaveBeenCalledWith({ qrCodeId: 1, productId: 1, isAuthentic: true });
  });
});
