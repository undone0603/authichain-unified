import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hook = path.resolve(__dirname, "../ci/runner-job-started.sh");
const dirs: string[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function workspace() {
  const d = mkdtempSync(path.join(tmpdir(), "runner-hook-"));
  dirs.push(d);
  git(d, "init", "-q");
  git(d, "config", "user.email", "t@example.test");
  git(d, "config", "user.name", "t");
  mkdirSync(path.join(d, "workers"));
  writeFileSync(path.join(d, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(path.join(d, "workers", "a.ts"), "export {};\n");
  git(d, "add", ".");
  git(d, "commit", "-qm", "init");
  return d;
}

function runHook(d: string) {
  return execFileSync("bash", [hook], {
    env: { ...process.env, GITHUB_WORKSPACE: d },
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// The hook runs on the Linux self-hosted runners; CI runs this on Linux.
describe.skipIf(process.platform === "win32")("runner job-started hook", () => {
  it("leaves a normal workspace in place and clears PR refs", () => {
    const d = workspace();
    mkdirSync(path.join(d, ".git/refs/remotes/pull/1"), { recursive: true });
    writeFileSync(
      path.join(d, ".git/refs/remotes/pull/1/merge"),
      "0".repeat(40)
    );
    const out = runHook(d);
    expect(out).toContain("cleared refs/remotes/pull");
    expect(existsSync(path.join(d, ".git/refs/remotes/pull"))).toBe(false);
    expect(existsSync(path.join(d, "pnpm-lock.yaml"))).toBe(true);
  });

  it("empties a workspace left sparse by an earlier job", () => {
    const d = workspace();
    // Non-cone, as gov-engine.yml and agentz-orchestration.yml check out two
    // files; cone mode would keep root files such as pnpm-lock.yaml.
    git(d, "sparse-checkout", "set", "--no-cone", "/workers/a.ts");
    expect(existsSync(path.join(d, "pnpm-lock.yaml"))).toBe(false);
    const out = runHook(d);
    expect(out).toContain("removed sparse workspace");
    expect(existsSync(path.join(d, ".git"))).toBe(false);
    expect(existsSync(d)).toBe(true);
  });

  it("does nothing outside a git workspace", () => {
    const d = mkdtempSync(path.join(tmpdir(), "runner-hook-"));
    dirs.push(d);
    expect(runHook(d)).toBe("");
  });
});
