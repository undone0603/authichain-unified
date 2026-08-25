import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock at the real module boundary: getDb() builds its instance via
// drizzle(pool), so intercepting drizzle() lets us observe db.ts internals
// (same-module calls can't be intercepted by mocking './db' itself).
const execute = vi.fn();
const insertValues = vi.fn().mockResolvedValue(undefined);
const insert = vi.fn(() => ({ values: insertValues }));
const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }));
vi.mock("drizzle-orm/node-postgres", () => ({
    drizzle: () => ({ execute, insert, update }),
}));
vi.mock("pg", () => ({ Pool: class {
    } }));
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
import * as db from "./db";
describe("Reputation Engine", () => {
    beforeEach(() => {
        execute.mockClear();
        insert.mockClear();
        insertValues.mockClear();
    });
    it("records a reputation event and upserts the user's points", async () => {
        await db.recordReputationEvent(123, "scan_authenticity_confirmed", 1);
        expect(execute).toHaveBeenCalledTimes(2);
        const eventSql = JSON.stringify(execute.mock.calls[0][0]);
        const upsertSql = JSON.stringify(execute.mock.calls[1][0]);
        expect(eventSql).toContain("reputation_events");
        expect(upsertSql).toContain("user_reputation");
    });
    it("awards a point for an authentic scan with a known user", async () => {
        await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true, userId: 123 });
        expect(insertValues).toHaveBeenCalledWith({
            qrCodeId: 1,
            productId: 1,
            isAuthentic: true,
            userAgent: undefined,
        });
        expect(execute).toHaveBeenCalledTimes(2); // reputation event + upsert
    });
    it("does not touch reputation for anonymous scans", async () => {
        await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true });
        expect(insert).toHaveBeenCalledTimes(1);
        expect(execute).not.toHaveBeenCalled();
    });
});
