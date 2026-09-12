import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the GitHub REST wrapper so these tests never make a real network call.
vi.mock("./github-service.js", () => ({
  createPR: vi.fn(),
  getPR: vi.fn(),
  getPRFiles: vi.fn(),
  addPRReview: vi.fn(),
  addPRComment: vi.fn(),
  mergePR: vi.fn(),
  getLatestRunForSha: vi.fn(),
}));

// ENV is a plain object computed once at import time from process.env; mock
// it so requireDevApproval can be flipped per test without touching real env
// vars (and without needing to re-import the module between tests).
vi.mock("../../_core/env.js", () => ({
  ENV: { requireDevApproval: true },
}));

const insertValues = vi.fn().mockResolvedValue(undefined);
const dbInsert = vi.fn().mockReturnValue({ values: insertValues });
const dbStub = { insert: dbInsert };

vi.mock("../../db.js", () => ({
  logActivity: vi.fn(),
  markTaskWaitingHuman: vi.fn(),
  getDb: vi.fn().mockResolvedValue(dbStub),
}));

const { runMergePR } = await import("./pr-manager.js");
const { getPR, addPRComment, mergePR, getLatestRunForSha } =
  await import("./github-service.js");
const { markTaskWaitingHuman } = await import("../../db.js");
const { ENV } = await import("../../_core/env.js");

function makeTask(prNumber: number, branch = "agentz/feature-x") {
  return {
    id: "task-1",
    missionId: "mission-1",
    payload: { prNumber, branch },
  } as any;
}

function makePr(
  overrides: Partial<{
    state: string;
    mergeable: boolean | null;
    sha: string;
  }> = {}
) {
  return {
    number: 42,
    state: overrides.state ?? "open",
    mergeable: overrides.mergeable ?? true,
    mergeable_state: "clean",
    head: { sha: overrides.sha ?? "abc123def456", ref: "agentz/feature-x" },
    base: { ref: "main" },
    title: "Some PR",
    body: "",
    html_url: "https://github.com/x/y/pull/42",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ENV.requireDevApproval = true;
  insertValues.mockClear();
  dbInsert.mockClear();
});

describe("runMergePR: CI status gate", () => {
  it("defers (re-enqueues MERGE_PR, does not throw or fail) when no CI run exists yet for the head SHA", async () => {
    (getPR as any).mockResolvedValue(makePr());
    (getLatestRunForSha as any).mockResolvedValue(null);

    await expect(runMergePR(makeTask(42))).resolves.toBeUndefined();

    expect(mergePR).not.toHaveBeenCalled();
    expect(markTaskWaitingHuman).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "MERGE_PR", missionId: "mission-1" })
    );
  });

  it("defers (re-enqueues MERGE_PR, does not throw or fail) while CI is still in progress", async () => {
    (getPR as any).mockResolvedValue(makePr());
    (getLatestRunForSha as any).mockResolvedValue({
      id: 1,
      status: "in_progress",
      conclusion: null,
      html_url: "https://github.com/x/y/actions/runs/1",
      head_sha: "abc123def456",
      created_at: new Date().toISOString(),
    });

    await expect(runMergePR(makeTask(42))).resolves.toBeUndefined();

    expect(mergePR).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "MERGE_PR", missionId: "mission-1" })
    );
  });

  it("enqueues AUTO_FIX and throws when CI completed but failed", async () => {
    (getPR as any).mockResolvedValue(makePr());
    (getLatestRunForSha as any).mockResolvedValue({
      id: 2,
      status: "completed",
      conclusion: "failure",
      html_url: "https://github.com/x/y/actions/runs/2",
      head_sha: "abc123def456",
      created_at: new Date().toISOString(),
    });

    await expect(runMergePR(makeTask(42))).rejects.toThrow(
      /CI failed \(failure\)/
    );

    expect(mergePR).not.toHaveBeenCalled();
    expect(dbInsert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "AUTO_FIX", missionId: "mission-1" })
    );
  });

  it("does not check CI at all if the PR already has a merge conflict (existing guard runs first)", async () => {
    (getPR as any).mockResolvedValue(makePr({ mergeable: false }));

    await expect(runMergePR(makeTask(42))).rejects.toThrow(/merge conflicts/);

    expect(getLatestRunForSha).not.toHaveBeenCalled();
  });
});

describe("runMergePR: approval gate, only reached once CI is green", () => {
  it("marks the task waiting-human and comments instead of merging when requireDevApproval is true", async () => {
    (getPR as any).mockResolvedValue(makePr());
    (getLatestRunForSha as any).mockResolvedValue({
      id: 3,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/x/y/actions/runs/3",
      head_sha: "abc123def456",
      created_at: new Date().toISOString(),
    });
    ENV.requireDevApproval = true;

    await runMergePR(makeTask(42));

    expect(markTaskWaitingHuman).toHaveBeenCalledWith("task-1");
    expect(addPRComment).toHaveBeenCalled();
    expect(mergePR).not.toHaveBeenCalled();
  });

  it("merges automatically once CI is green and requireDevApproval is false", async () => {
    (getPR as any).mockResolvedValue(makePr());
    (getLatestRunForSha as any).mockResolvedValue({
      id: 4,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/x/y/actions/runs/4",
      head_sha: "abc123def456",
      created_at: new Date().toISOString(),
    });
    ENV.requireDevApproval = false;

    await runMergePR(makeTask(42));

    expect(mergePR).toHaveBeenCalledWith(42, "squash");
    expect(markTaskWaitingHuman).not.toHaveBeenCalled();
  });
});
