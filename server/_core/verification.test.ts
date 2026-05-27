import { describe, expect, it } from "vitest";
import {
  generateVerificationHash,
  createVerificationRecord,
  verifyHash,
  buildVerificationUrl,
  issueVerificationUrl,
  quickVerify,
  type VerificationPayload,
  type QRVerificationRecord,
} from "./verification";

describe("verification", () => {
  const NOW = Date.now();
  const payload: VerificationPayload = {
    productId: "42",
    batchId: "batch-001",
    timestamp: NOW,
  };

  describe("generateVerificationHash", () => {
    it("returns a 64-char hex string", () => {
      const hash = generateVerificationHash(payload);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("is deterministic", () => {
      expect(generateVerificationHash(payload)).toBe(generateVerificationHash(payload));
    });

    it("changes when productId changes", () => {
      const other = { ...payload, productId: "99" };
      expect(generateVerificationHash(payload)).not.toBe(generateVerificationHash(other));
    });

    it("treats missing batchId as empty string (stable across calls)", () => {
      const noBatch = { productId: "42", timestamp: NOW };
      const emptyBatch = { productId: "42", batchId: "", timestamp: NOW };
      expect(generateVerificationHash(noBatch)).toBe(generateVerificationHash(emptyBatch));
    });
  });

  describe("createVerificationRecord", () => {
    it("returns a record with correct shape", () => {
      const record = createVerificationRecord(payload);
      expect(record.id).toMatch(/^vrf_/);
      expect(record.productId).toBe("42");
      expect(record.hash).toHaveLength(64);
      expect(record.scanCount).toBe(0);
      expect(record.revoked).toBe(false);
      expect(record.expiresAt).toBeInstanceOf(Date);
    });

    it("sets TTL relative to payload timestamp", () => {
      const ttlMs = 60_000;
      const record = createVerificationRecord(payload, ttlMs);
      expect(record.expiresAt!.getTime()).toBe(NOW + ttlMs);
    });
  });

  describe("verifyHash", () => {
    it("returns valid=true for a matching hash", () => {
      const record = createVerificationRecord(payload);
      const result = verifyHash(record.hash, record);
      expect(result.valid).toBe(true);
      expect(result.message).toContain("Authentic");
    });

    it("returns valid=false for a wrong hash", () => {
      const record = createVerificationRecord(payload);
      const result = verifyHash("deadbeef".repeat(8), record);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("counterfeit");
    });

    it("returns valid=false when revoked", () => {
      const record: QRVerificationRecord = {
        ...createVerificationRecord(payload),
        revoked: true,
      };
      const result = verifyHash(record.hash, record);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("revoked");
    });

    it("returns valid=false when expired", () => {
      const expiredRecord: QRVerificationRecord = {
        ...createVerificationRecord(payload),
        expiresAt: new Date(Date.now() - 1000),
      };
      const result = verifyHash(expiredRecord.hash, expiredRecord);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("expired");
    });
  });

  describe("buildVerificationUrl", () => {
    it("includes id and hash as query params", () => {
      const url = buildVerificationUrl("https://authichain.com", "42", "abc123");
      expect(url).toContain("/verify");
      expect(url).toContain("id=42");
      expect(url).toContain("hash=abc123");
    });
  });

  describe("issueVerificationUrl", () => {
    it("returns a url, hash, and record", () => {
      const result = issueVerificationUrl("https://authichain.com", "42", "batch-1");
      expect(result.url).toContain("/verify");
      expect(result.hash).toHaveLength(64);
      expect(result.record.productId).toBe("42");
      expect(result.url).toContain(result.hash);
    });
  });

  describe("quickVerify", () => {
    it("accepts a valid-looking 64-char hex hash", () => {
      expect(quickVerify("42", "a".repeat(64))).toBe(true);
    });

    it("rejects a short hash", () => {
      expect(quickVerify("42", "abc")).toBe(false);
    });
  });
});
