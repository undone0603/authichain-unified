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
    it("returns all 6 services", async () => {
      const catalog = await publicCaller.services.catalog();
      expect(catalog).toHaveLength(6);
      const keys = catalog.map((s: any) => s.key);
      expect(keys).toContain("authenticity_audit");
      expect(keys).toContain("cinematic_page");
      expect(keys).toContain("automation_setup");
      expect(keys).toContain("landing_page");
      expect(keys).toContain("brand_story_pack");
      expect(keys).toContain("government_dossier");
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

  describe("services.getService (public)", () => {
    it("returns a specific service by key", async () => {
      const service = await publicCaller.services.getService({ key: "authenticity_audit" });
      expect(service.name).toBe("Authenticity Intelligence Audit");
      expect(service.price).toBe(25000);
    });

    it("throws NOT_FOUND for invalid key", async () => {
      await expect(publicCaller.services.getService({ key: "nonexistent" })).rejects.toThrow();
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
});
