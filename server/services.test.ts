import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

const publicCaller = appRouter.createCaller({ user: null } as any);
const authedCaller = appRouter.createCaller({
  user: { id: 1, name: "Test User", email: "test@example.com", role: "user", openId: "test-open-id" },
} as any);
const adminCaller = appRouter.createCaller({
  user: { id: 1, name: "Admin", email: "admin@example.com", role: "admin", openId: "admin-open-id" },
} as any);

describe("services router", () => {
  describe("services.catalog (public)", () => {
    it("returns all 7 services", async () => {
      const catalog = await publicCaller.services.catalog();
      expect(catalog).toHaveLength(7);
      const keys = catalog.map((s: any) => s.key);
      expect(keys).toContain("authenticity_audit");
      expect(keys).toContain("cinematic_page");
      expect(keys).toContain("automation_setup");
      expect(keys).toContain("landing_page");
      expect(keys).toContain("brand_story_pack");
      expect(keys).toContain("government_dossier");
      expect(keys).toContain("sba_disaster_loan");
    });

    it("each service has required fields", async () => {
      const catalog = await publicCaller.services.catalog();
      for (const service of catalog) {
        expect(service).toHaveProperty("key");
        expect(service).toHaveProperty("name");
        expect(service).toHaveProperty("price");
        expect(service).toHaveProperty("displayPrice");
        expect(service).toHaveProperty("stripeProductId");
        expect(service).toHaveProperty("stripePriceId");
        expect(service).toHaveProperty("deliverables");
        expect(service).toHaveProperty("deliveryTime");
      }
    });
  });

  describe("services.myOrders (protected)", () => {
    it("rejects unauthenticated users", async () => {
      await expect(publicCaller.services.myOrders()).rejects.toThrow();
    });

    it("returns array for authenticated user", async () => {
      const orders = await authedCaller.services.myOrders();
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("services.allOrders (admin)", () => {
    it("rejects non-admin users", async () => {
      await expect(authedCaller.services.allOrders()).rejects.toThrow();
    });

    it("returns array for admin", async () => {
      const orders = await adminCaller.services.allOrders();
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("services.updateStatus (admin)", () => {
    it("rejects non-admin users", async () => {
      await expect(
        authedCaller.services.updateStatus({ id: 1, status: "paid" }),
      ).rejects.toThrow();
    });

    it("rejects invalid status values (zod enum)", async () => {
      await expect(
        adminCaller.services.updateStatus({ id: 1, status: "shipped" as any }),
      ).rejects.toThrow();
    });
  });
});
