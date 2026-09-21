import { describe, expect, it } from "vitest";
import { classifyBranch } from "../lib/branch-classify.mjs";

describe("classifyBranch", () => {
  it("does not treat green checks as mergeable by themselves", () => {
    const result = classifyBranch({
      files: [],
      requiredChecksGreen: true,
      title: "all green",
    });
    expect(result.class).toBe("needs_human");
  });

  it("marks already-merged PRs", () => {
    expect(classifyBranch({ merged: true }).class).toBe("already_merged");
  });

  it("marks commits already on main as superseded", () => {
    expect(classifyBranch({ commitsOnMain: true }).class).toBe(
      "duplicate_superseded"
    );
  });

  it("excludes Vercel deploy patches", () => {
    const result = classifyBranch({
      files: ["vercel.json"],
      patch: "vercel deploy --prod --yes",
    });
    expect(result.class).toBe("vercel_excluded");
  });

  it("escalates schema and stripe changes", () => {
    const result = classifyBranch({
      files: ["supabase/migrations/20260921000001_new.sql"],
    });
    expect(result.class).toBe("needs_human");
    expect(result.action).toBe("stop_request_decision");
  });

  it("classifies a small independent fix as mergeable but human-merge only", () => {
    const result = classifyBranch({
      files: ["src/lib/foo.ts", "src/lib/foo.test.ts"],
      draft: false,
    });
    expect(result.class).toBe("mergeable");
    expect(result.action).toBe("pr_human_merge");
  });
});
