// src/lib/admin-key.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkAdminKey,
  constantTimeEqual,
  MIN_ADMIN_KEY_LENGTH,
  presentedAdminKey,
} from "./admin-key";

const KEY = "k".repeat(MIN_ADMIN_KEY_LENGTH) + "-rotated";
const url = "https://authichain.com/api/admin/revenue";

describe("checkAdminKey", () => {
  it("accepts the configured key as a bearer token, header or query", () => {
    expect(
      checkAdminKey(
        new Request(url, { headers: { authorization: `Bearer ${KEY}` } }),
        KEY
      )
    ).toBe(true);
    expect(
      checkAdminKey(new Request(url, { headers: { "x-admin-key": KEY } }), KEY)
    ).toBe(true);
    expect(
      checkAdminKey(new Request(`${url}?key=${encodeURIComponent(KEY)}`), KEY)
    ).toBe(true);
  });

  it("refuses the old hard-coded literal", () => {
    expect(checkAdminKey(new Request(`${url}?key=authichain2026`), KEY)).toBe(
      false
    );
  });

  it("fails closed when ADMIN_DASHBOARD_KEY is unset or too short", () => {
    expect(checkAdminKey(new Request(`${url}?key=anything`), undefined)).toBe(
      false
    );
    expect(checkAdminKey(new Request(`${url}?key=`), "")).toBe(false);
    // The leaked literal is 14 characters, so even if someone set the env var
    // to it, the gate stays shut until the key is rotated.
    expect(
      checkAdminKey(new Request(`${url}?key=authichain2026`), "authichain2026")
    ).toBe(false);
  });

  it("refuses a missing, empty or wrong key", () => {
    expect(checkAdminKey(new Request(url), KEY)).toBe(false);
    expect(
      checkAdminKey(
        new Request(url, { headers: { authorization: "Bearer " } }),
        KEY
      )
    ).toBe(false);
    expect(checkAdminKey(new Request(`${url}?key=${KEY}x`), KEY)).toBe(false);
  });

  it("prefers the Authorization header over the query string", () => {
    const req = new Request(`${url}?key=wrong`, {
      headers: { authorization: `Bearer ${KEY}` },
    });
    expect(presentedAdminKey(req)).toBe(KEY);
  });
});

describe("constantTimeEqual", () => {
  it("matches only identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("admin routes carry no literal key", () => {
  it("src/app/api/admin/revenue/route.ts uses checkAdminKey and keeps requireAdmin", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/api/admin/revenue/route.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/authichain2026/);
    expect(src).toMatch(/checkAdminKey\(/);
    expect(src).toMatch(/requireAdmin\(/);
    expect(src).not.toMatch(/dashboardKeyMatches/);
  });
});
