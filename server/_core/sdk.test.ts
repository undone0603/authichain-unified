import { describe, it, expect, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import * as db from "../db";

// Mock the db module to avoid database dependencies
vi.mock("../db", () => ({
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(null),
}));

describe("sdk.authenticateRequest", () => {
  describe("cookie extraction from Fetch Request", () => {
    it("extracts cookie header from a real Fetch Request using headers.get()", async () => {
      const testCookieValue = "test-token-fetch-123";
      const req = new Request("https://authichain.com/api/test", {
        headers: {
          Cookie: COOKIE_NAME + "=" + testCookieValue + "; other=value",
        },
      });

      // Spy on verifySession to confirm the cookie was extracted correctly
      const verifySpy = vi.spyOn(sdk, "verifySession");
      
      try {
        await sdk.authenticateRequest(req as any);
      } catch (error) {
        // Expected to fail due to invalid session, but extraction should have worked
        expect(error).toBeDefined();
      }

      // Verify that verifySession was called with the correct cookie value
      // This proves getCookieHeader extracted it from headers.get()
      expect(verifySpy).toHaveBeenCalledWith(testCookieValue);
      
      verifySpy.mockRestore();
    });
  });

  describe("cookie extraction from Express-like object", () => {
    it("extracts cookie header from Express-like request object using headers.cookie property", async () => {
      const testCookieValue = "test-token-express-456";
      const req = {
        headers: {
          cookie: COOKIE_NAME + "=" + testCookieValue + "; other=value",
        },
      };

      // Spy on verifySession to confirm the cookie was extracted correctly
      const verifySpy = vi.spyOn(sdk, "verifySession");
      
      try {
        await sdk.authenticateRequest(req as any);
      } catch (error) {
        // Expected to fail due to invalid session, but extraction should have worked
        expect(error).toBeDefined();
      }

      // Verify that verifySession was called with the correct cookie value
      // This proves getCookieHeader extracted it from headers.cookie
      expect(verifySpy).toHaveBeenCalledWith(testCookieValue);
      
      verifySpy.mockRestore();
    });
  });

  describe("cookie extraction handles missing cookies gracefully", () => {
    it("handles Fetch Request with no matching cookie", async () => {
      const req = new Request("https://authichain.com/api/test", {
        headers: {
          Cookie: "other=value",
        },
      });

      const verifySpy = vi.spyOn(sdk, "verifySession");

      try {
        await sdk.authenticateRequest(req as any);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // verifySession should be called with undefined (no matching cookie found)
      expect(verifySpy).toHaveBeenCalledWith(undefined);
      
      verifySpy.mockRestore();
    });

    it("handles Express-like object with no matching cookie", async () => {
      const req = {
        headers: {
          cookie: "other=value",
        },
      };

      const verifySpy = vi.spyOn(sdk, "verifySession");

      try {
        await sdk.authenticateRequest(req as any);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // verifySession should be called with undefined (no matching cookie found)
      expect(verifySpy).toHaveBeenCalledWith(undefined);
      
      verifySpy.mockRestore();
    });
  });
});
