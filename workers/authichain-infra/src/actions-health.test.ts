// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkGitHubActions, classifyActions, publicCause } from "./actions-health";

const now = Date.parse("2026-10-15T14:00:00Z");
const run = (id: number, conclusion: string, created_at = "2026-10-15T13:30:00Z") => ({
  id,
  status: "completed",
  conclusion,
  created_at,
});

describe("classifyActions", () => {
  it("is down when every recent run failed and nothing succeeded for hours, and names a billing lock", () => {
    const h = classifyActions(
      [run(1, "failure"), run(2, "failure"), run(3, "startup_failure")],
      "2026-10-15T05:10:29Z",
      "The job was not started because your account is locked due to a billing issue.",
      now
    );
    expect(h.status).toBe("down");
    expect(h.detail).toContain("account locked due to a billing issue");
    expect(h.detail).toContain("last success 2026-10-15T05:10:29Z");
  });

  it("is ok when a recent run succeeded", () => {
    expect(classifyActions([run(1, "failure"), run(2, "success")], "2026-10-15T13:00:00Z", null, now).status).toBe(
      "ok"
    );
  });

  it("does not page for a short burst of failures right after a success", () => {
    expect(classifyActions([run(1, "failure")], "2026-10-15T13:00:00Z", null, now).status).toBe("ok");
  });

  it("warns, not ok, when there is nothing completed to judge", () => {
    expect(classifyActions([], null, null, now).status).toBe("warn");
  });

  it("keeps the cause short", () => {
    expect(publicCause("x".repeat(500)).length).toBe(120);
  });
});

describe("checkGitHubActions", () => {
  it("reads runs, the last success and the failed job's annotation", async () => {
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url.replace("https://api.github.com/repos/o/r", ""));
      const body = url.includes("status=success")
        ? { workflow_runs: [{ created_at: "2026-10-15T05:10:29Z" }] }
        : url.includes("/actions/runs?per_page=20")
          ? { workflow_runs: [run(9, "failure", new Date().toISOString())] }
          : url.includes("/jobs")
            ? { jobs: [{ id: 77 }] }
            : [{ annotation_level: "failure", message: "account is locked due to a billing issue" }];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const h = await checkGitHubActions("t", "o/r", fake);
    expect(h.status).toBe("down");
    expect(h.detail).toContain("billing");
    expect(seen).toContain("/check-runs/77/annotations");
  });

  it("skips without a token and warns (never ok) when GitHub cannot be read", async () => {
    expect((await checkGitHubActions(undefined)).status).toBe("skip");
    const failing = (async () => new Response("", { status: 502 })) as unknown as typeof fetch;
    expect((await checkGitHubActions("t", "o/r", failing)).status).toBe("warn");
  });
});
