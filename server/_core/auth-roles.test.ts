import { describe, it, expect } from "vitest";
import { resolveRole } from "./auth-roles";

describe("resolveRole", () => {
  const owners = "undone.k@gmail.com, authichain@gmail.com, Z@authichain.com";
  it("returns admin for an owner email (case-insensitive)", () => {
    expect(resolveRole("Z@AUTHICHAIN.COM", owners)).toBe("admin");
    expect(resolveRole("undone.k@gmail.com", owners)).toBe("admin");
  });
  it("returns user for a non-owner email", () => {
    expect(resolveRole("someone@example.com", owners)).toBe("user");
  });
  it("trims whitespace around entries", () => {
    expect(resolveRole("authichain@gmail.com", "  authichain@gmail.com  ")).toBe("admin");
  });
  it("returns user when allowlist is empty or email missing", () => {
    expect(resolveRole("a@b.com", "")).toBe("user");
    expect(resolveRole("", owners)).toBe("user");
  });
});
