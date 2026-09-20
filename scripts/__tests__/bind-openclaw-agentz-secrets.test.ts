import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = join(
  repoRoot,
  ".github",
  "workflows",
  "deploy-workers.yml"
);
const scriptPath = join(
  repoRoot,
  "scripts",
  "ci",
  "bind-openclaw-agentz-secrets.sh"
);

function clawBindStep(yml: string): string {
  const start = yml.indexOf("- name: Bind claw AGENTZ_* secrets");
  expect(start).toBeGreaterThan(-1);
  const rest = yml.slice(start);
  const next = rest.search(/\n      - name: /);
  return next === -1 ? rest : rest.slice(0, next);
}

function runBind(
  env: NodeJS.ProcessEnv,
  wranglerLog: string,
  wranglerExit = 0
) {
  const fakeBin = mkdtempSync(join(tmpdir(), "wrangler-fake-"));
  const wrangler = join(fakeBin, "wrangler");
  writeFileSync(
    wrangler,
    `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${wranglerLog}"
if [ "\${1:-}" = "secret" ] && [ "\${2:-}" = "put" ]; then
  cat >/dev/null
fi
exit ${wranglerExit}
`
  );
  chmodSync(wrangler, 0o755);
  try {
    return spawnSync("bash", [scriptPath], {
      env: {
        ...process.env,
        ...env,
        WRANGLER_BIN: wrangler,
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(fakeBin, { recursive: true, force: true });
  }
}

describe("deploy-workers openclaw AGENT_SECRET bind", () => {
  it("keeps authichain-openclaw on the $0 matrix and omits authichain-agentz until opt-in", () => {
    const yml = readFileSync(workflowPath, "utf8");
    const buildStart = yml.indexOf("workers=$(jq -nc '[");
    const buildEnd = yml.indexOf("]')", buildStart);
    const defaultList = yml.slice(buildStart, buildEnd + 2);
    expect(defaultList).toContain('"authichain-openclaw"');
    expect(defaultList).not.toContain("authichain-agentz");
    expect(yml).toMatch(/\$w \+ \["authichain-agentz"\]/);
  });

  it("does not hard-fail the claw bind when AGENT_SECRET is empty", () => {
    const yml = readFileSync(workflowPath, "utf8");
    const step = clawBindStep(yml);
    expect(step).not.toMatch(/::error::GitHub secret AGENT_SECRET is empty/);
    expect(step).not.toMatch(/exit 1/);
    expect(step).not.toMatch(/continue-on-error:/);
    expect(step).toContain("scripts/ci/bind-openclaw-agentz-secrets.sh");
    expect(step).toContain("AGENT_SECRET: ${{ secrets.AGENT_SECRET }}");
  });
});

describe("bind-openclaw-agentz-secrets.sh", () => {
  it("warns and skips AGENTZ_API_KEY when AGENT_SECRET is empty, still binds AGENTZ_API_URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "openclaw-bind-"));
    const log = join(dir, "wrangler.log");
    writeFileSync(log, "");
    try {
      const result = runBind({ AGENT_SECRET: "" }, log);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).toBe(0);
      expect(combined).toMatch(/::warning::/);
      expect(combined).toMatch(/skipping AGENTZ_API_KEY/);
      expect(combined).not.toMatch(/::error::/);
      expect(combined).not.toContain("bound AGENTZ_API_URL + AGENTZ_API_KEY");
      const calls = readFileSync(log, "utf8");
      expect(calls).toMatch(
        /secret put AGENTZ_API_URL --name authichain-openclaw/
      );
      expect(calls).not.toMatch(/AGENTZ_API_KEY/);
      expect(calls).not.toMatch(/authichain-agentz/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("binds AGENTZ_API_KEY when AGENT_SECRET is set and never prints the value", () => {
    const dir = mkdtempSync(join(tmpdir(), "openclaw-bind-"));
    const log = join(dir, "wrangler.log");
    writeFileSync(log, "");
    const secret = "test-agent-secret-value-do-not-log";
    try {
      const result = runBind({ AGENT_SECRET: secret }, log);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).toBe(0);
      expect(combined).not.toMatch(/::warning::/);
      expect(combined).not.toMatch(/::error::/);
      expect(combined).toContain("bound AGENTZ_API_URL + AGENTZ_API_KEY");
      expect(combined).not.toContain(secret);
      const calls = readFileSync(log, "utf8");
      expect(calls).toMatch(
        /secret put AGENTZ_API_URL --name authichain-openclaw/
      );
      expect(calls).toMatch(
        /secret put AGENTZ_API_KEY --name authichain-openclaw/
      );
      expect(calls).not.toContain(secret);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still fails when wrangler cannot bind AGENTZ_API_URL even if AGENT_SECRET is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "openclaw-bind-"));
    const log = join(dir, "wrangler.log");
    writeFileSync(log, "");
    try {
      const result = runBind({ AGENT_SECRET: "" }, log, 1);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(combined).not.toMatch(/skipping AGENTZ_API_KEY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
