import { describe, it, expect, vi } from "vitest";
import { AuditReportService } from "./audit-report";

// Mock DB
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        productId: "prod1",
        eventType: "manufacturing",

        createdAt: new Date("2026-08-30T10:00:00Z"),
        metadata: {
          lotNumber: "LOT123",
          expirationDate: "2027-08-30T00:00:00Z",
          tradingPartnerId: "PARTNER_1",
          transactionId: "TX_999",
        },
      },
    ]),
    query: {
      products: {
        findFirst: vi.fn().mockResolvedValue({ id: "prod1" }),
      },
    },
  },
}));

describe("AuditReportService", () => {
  it("generates a compliant report", async () => {
    const service = new AuditReportService();
    const report = await service.generateDscsaReport("prod1");
    expect(report.subject_id).toBe("prod1");
    expect(report.events.length).toBe(1);
    expect(report.is_tamper_evident).toBe(true);
  });
});
