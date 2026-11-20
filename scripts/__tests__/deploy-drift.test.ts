import { describe, expect, it } from "vitest";
import { TARGETS, driftCommits, isWorkerSource } from "../ops/deploy-drift.mjs";

const com = TARGETS.find(t => t.worker === "authichain-com")!.paths;

describe("deploy drift", () => {
  it("counts Worker source and the code it imports", () => {
    expect(
      isWorkerSource("workers/authichain-com/src/mcp-routes.ts", com)
    ).toBe(true);
    expect(
      isWorkerSource(
        "workers/authichain-verify-worker/src/protocol-verify.mjs",
        com
      )
    ).toBe(true);
    expect(isWorkerSource("src/lib/plans.ts", com)).toBe(true);
    expect(isWorkerSource("worker-app/growth-record.ts", com)).toBe(true);
    expect(isWorkerSource("server.json", com)).toBe(true);
  });

  it("ignores tests, docs and unrelated code", () => {
    expect(
      isWorkerSource("workers/authichain-com/src/mcp-routes.test.ts", com)
    ).toBe(false);
    expect(isWorkerSource("workers/authichain-com/test/routing.ts", com)).toBe(
      false
    );
    expect(isWorkerSource("docs/OPERATING_CHARTER.md", com)).toBe(false);
    expect(isWorkerSource("worker-app/index.ts", com)).toBe(false);
    expect(isWorkerSource("server.json.bak/x", com)).toBe(false);
    expect(isWorkerSource("protocolx/a.mjs", com)).toBe(false);
  });

  it("keeps only commits that change Worker source", () => {
    const out = driftCommits(
      [
        {
          sha: "c3",
          date: "2026-11-18",
          subject: "fix rpc",
          files: [
            "workers/authichain-verify-worker/src/protocol-verify.mjs",
            "workers/authichain-verify-worker/src/protocol-verify.test.mjs",
          ],
        },
        {
          sha: "c2",
          date: "2026-11-17",
          subject: "docs",
          files: ["docs/a.md"],
        },
        {
          sha: "c1",
          date: "2026-11-16",
          subject: "test only",
          files: ["src/lib/plans.test.ts"],
        },
      ],
      com
    );
    expect(out.map(c => c.sha)).toEqual(["c3"]);
    expect(out[0].files).toEqual([
      "workers/authichain-verify-worker/src/protocol-verify.mjs",
    ]);
  });

  it("watches both protected production deploys", () => {
    expect(TARGETS.map(t => t.workflow)).toEqual([
      "deploy-authichain-com.yml",
      "deploy-authichain-edge-router.yml",
    ]);
  });
});
