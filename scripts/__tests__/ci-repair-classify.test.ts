import { describe, expect, it } from "vitest";
import { classifyRepair } from "../lib/ci-repair-classify.mjs";

describe("classifyRepair", () => {
  it("allows prettier/eslint autofix on source files", () => {
    const result = classifyRepair({
      files: ["src/lib/foo.ts"],
      jobName: "Lint",
      logExcerpt: "eslint --fix",
    });
    expect(result.safe).toBe(true);
    expect(result.kind).toBe("format_lint");
  });

  it("refuses migration edits", () => {
    expect(
      classifyRepair({
        files: ["supabase/migrations/20260921000001_x.sql"],
        jobName: "Lint",
      }).safe
    ).toBe(false);
  });

  it("refuses deleting tests", () => {
    expect(
      classifyRepair({
        files: ["src/lib/foo.test.ts"],
        patch:
          "diff --git a/src/lib/foo.test.ts b//dev/null\ndeleted file mode",
      }).safe
    ).toBe(false);
  });

  it("refuses permission weakening", () => {
    expect(
      classifyRepair({
        files: ["src/lib/foo.ts"],
        patch: "permissions:\n  contents: write\n  id-token: write\n",
      }).safe
    ).toBe(false);
  });

  it("allows a prettier fix to .github JSON manifests under the Lint job", () => {
    const result = classifyRepair({
      files: [".github/autonomy.json", ".github/founder-business.json"],
      jobName: "Lint",
    });
    expect(result.safe).toBe(true);
  });

  it("refuses repair diffs that touch workflow files", () => {
    expect(
      classifyRepair({
        files: [".github/workflows/ci.yml"],
        jobName: "Lint",
      }).safe
    ).toBe(false);
  });

  it("escalates instead of repairing more than 20 files", () => {
    const files = Array.from({ length: 21 }, (_, i) => `src/lib/f${i}.ts`);
    const result = classifyRepair({ files, jobName: "Lint" });
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/escalate/);
  });

  it("refuses wrangler deploy in the repair diff", () => {
    expect(
      classifyRepair({
        files: ["scripts/x.sh"],
        patch: "wrangler deploy --minify",
      }).safe
    ).toBe(false);
  });
});
