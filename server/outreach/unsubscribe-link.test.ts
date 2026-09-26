// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  signedUnsubscribeUrl,
  unsubscribeCheckUrl,
  unsubscribeToken,
  UNSUBSCRIBE_CHECK_EMAIL,
  verifyUnsubscribeToken,
} from "./unsubscribe-link";

const SECRET = "test-optout-secret";

describe("unsubscribe tokens", () => {
  it("are 32 hex chars and ignore case and whitespace in the address", async () => {
    const a = await unsubscribeToken(SECRET, " Dana@AcmeLabs.com ");
    const b = await unsubscribeToken(SECRET, "dana@acmelabs.com");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(b);
  });

  it("match an independent HMAC with the v1 prefix (Node and Web Crypto agree)", async () => {
    const expected = createHmac("sha256", SECRET)
      .update("authichain-unsubscribe:v1:dana@acmelabs.com")
      .digest("hex")
      .slice(0, 32);
    expect(await unsubscribeToken(SECRET, "dana@acmelabs.com")).toBe(expected);
    // Domain-separated: not the bare HMAC of the address.
    const bare = createHmac("sha256", SECRET)
      .update("dana@acmelabs.com")
      .digest("hex")
      .slice(0, 32);
    expect(expected).not.toBe(bare);
  });

  it("verify only for the right address and secret", async () => {
    const t = await unsubscribeToken(SECRET, "dana@acmelabs.com");
    expect(await verifyUnsubscribeToken(SECRET, "dana@acmelabs.com", t)).toBe(
      true
    );
    expect(
      await verifyUnsubscribeToken(SECRET, "DANA@acmelabs.com", t.toUpperCase())
    ).toBe(true);
    expect(await verifyUnsubscribeToken(SECRET, "other@acmelabs.com", t)).toBe(
      false
    );
    expect(
      await verifyUnsubscribeToken("another-secret", "dana@acmelabs.com", t)
    ).toBe(false);
    expect(
      await verifyUnsubscribeToken(SECRET, "dana@acmelabs.com", t.slice(0, 31))
    ).toBe(false);
    expect(await verifyUnsubscribeToken("", "dana@acmelabs.com", t)).toBe(
      false
    );
  });

  it("refuses to sign without a secret", async () => {
    await expect(unsubscribeToken("", "a@b.co")).rejects.toThrow();
  });
});

describe("signed URLs", () => {
  it("point at the edge route with the address and token", async () => {
    const url = new URL(
      await signedUnsubscribeUrl({ secret: SECRET, email: "Dana@AcmeLabs.com" })
    );
    expect(url.origin).toBe("https://authichain.com");
    expect(url.pathname).toBe("/api/outreach/unsubscribe");
    expect(url.searchParams.get("e")).toBe("dana@acmelabs.com");
    expect(
      await verifyUnsubscribeToken(
        SECRET,
        "dana@acmelabs.com",
        url.searchParams.get("t")!
      )
    ).toBe(true);
  });

  it("the check URL only ever names the reserved .invalid address", async () => {
    const url = new URL(
      await unsubscribeCheckUrl({
        secret: SECRET,
        origin: "https://staging.example/",
      })
    );
    expect(url.origin).toBe("https://staging.example");
    expect(url.pathname).toBe("/api/outreach/unsubscribe/check");
    expect(url.searchParams.get("e")).toBe(UNSUBSCRIBE_CHECK_EMAIL);
    expect(UNSUBSCRIBE_CHECK_EMAIL.endsWith(".invalid")).toBe(true);
  });
});
