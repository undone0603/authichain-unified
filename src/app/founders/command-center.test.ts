import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(import.meta.dirname, "command-center.tsx"),
  "utf8"
);

describe("FoundersCommand pipeline monitor", () => {
  it("polls GET /api/founders/monitor and pauses when the tab is hidden", () => {
    expect(src).toContain('fetch("/api/founders/monitor"');
    expect(src).toContain("visibilitychange");
    expect(src).toContain("document.hidden");
    expect(src).toContain("MONITOR_POLL_MS");
    expect(src).toContain('window.location.href = "/login?next=/founders"');
    expect(src).not.toMatch(/NEXT_PUBLIC_GITHUB_MONITOR_TOKEN/);
  });
});
