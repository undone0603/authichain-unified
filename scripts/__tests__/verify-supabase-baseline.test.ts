import { describe, expect, it } from "vitest";
import {
  missingRemoteVersions,
  remoteVersions,
} from "../verify-supabase-baseline.mjs";

describe("verify-supabase-baseline", () => {
  it("has no remote-applied versions missing locally", () => {
    expect(missingRemoteVersions()).toEqual([]);
  });

  it("pins the #1133 remote list is non-empty", () => {
    expect(remoteVersions().length).toBeGreaterThan(10);
  });
});
