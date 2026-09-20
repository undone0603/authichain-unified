import { describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = join(
  repoRoot,
  ".github",
  "workflows",
  "agentz-tunnel-bringup.yml"
);
const resolvePath = join(
  repoRoot,
  "scripts",
  "agentz-tunnel",
  "resolve-agent-secret.sh"
);

function runResolve(env: NodeJS.ProcessEnv, ghLog: string, ghExit = 0) {
  const fakeBin = mkdtempSync(join(tmpdir(), "gh-fake-"));
  const gh = join(fakeBin, "gh");
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
set -euo pipefail
{
  printf 'argv:'
  for a in "$@"; do printf ' %s' "$a"; done
  printf '\\n'
  if [ -t 0 ]; then
    echo "stdin=tty"
  else
    body="$(cat)"
    echo "stdin_len=\${#body}"
  fi
} >> "${ghLog}"
exit ${ghExit}
`
  );
  chmodSync(gh, 0o755);
  try {
    return spawnSync("bash", [resolvePath], {
      env: {
        ...process.env,
        ...env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(fakeBin, { recursive: true, force: true });
  }
}

describe("agentz-tunnel-bringup.yml gh secret set", () => {
  it("does not use unsupported --body-file (run 35471852735)", () => {
    const yml = readFileSync(workflowPath, "utf8");
    expect(yml).not.toMatch(/gh secret set[^\n]*--body-file/);
    expect(yml).toMatch(/gh secret set AGENTZ_TUNNEL_TOKEN --app actions < /);
  });

  it("keeps the $0 path: no Containers deploy, no Workers Paid", () => {
    const yml = readFileSync(workflowPath, "utf8");
    expect(yml).toMatch(/Containers stay undeployed \(no Workers Paid\)/);
    expect(yml).not.toMatch(/wrangler deploy/);
    expect(yml).not.toMatch(/deploy_agentz_containers/);
    expect(yml).toMatch(/skipped OPENCLAW_GATEWAY_URL/);
  });

  it("refuses to bind claw when the resolved AGENT_SECRET file is empty", () => {
    const yml = readFileSync(workflowPath, "utf8");
    const start = yml.indexOf(
      "- name: Put AGENTZ_API_URL + AGENTZ_API_KEY on authichain-openclaw"
    );
    expect(start).toBeGreaterThan(-1);
    const rest = yml.slice(start);
    const next = rest.search(/\n      - name: /);
    const step = next === -1 ? rest : rest.slice(0, next);
    expect(step).toMatch(/\[ ! -s "\$\{?AGENT_SECRET_OUT/);
    expect(step).toMatch(/resolve-agent-secret\.sh/);
    expect(step).toContain("AGENT_SECRET: ${{ secrets.AGENT_SECRET }}");
  });
});

describe("resolve-agent-secret.sh", () => {
  it("does not invoke gh with --body-file", () => {
    const src = readFileSync(resolvePath, "utf8");
    expect(src).not.toMatch(/gh secret set[^\n]*--body-file/);
    expect(src).toMatch(/gh secret set AGENT_SECRET --app actions < /);
  });

  it("reuses a non-empty AGENT_SECRET without calling gh", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-secret-"));
    const out = join(dir, "secret.txt");
    const ghLog = join(dir, "gh.log");
    writeFileSync(ghLog, "");
    const secret = "existing-agent-secret-value-do-not-log";
    try {
      const result = runResolve(
        { AGENT_SECRET: secret, AGENT_SECRET_OUT: out },
        ghLog
      );
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).toBe(0);
      expect(readFileSync(out, "utf8")).toBe(secret);
      expect(combined).toMatch(/using existing GitHub secret AGENT_SECRET/);
      expect(combined).not.toContain(secret);
      expect(readFileSync(ghLog, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats whitespace-only AGENT_SECRET as empty and fails without a PAT", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-secret-"));
    const out = join(dir, "secret.txt");
    const ghLog = join(dir, "gh.log");
    writeFileSync(ghLog, "");
    try {
      const result = runResolve(
        { AGENT_SECRET: " \n\t ", AGENT_SECRET_OUT: out },
        ghLog
      );
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(combined).toMatch(/::error::GitHub secret AGENT_SECRET is empty/);
      expect(readFileSync(ghLog, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mints via stdin to gh secret set when AGENT_SECRET is empty and a PAT exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-secret-"));
    const out = join(dir, "secret.txt");
    const ghLog = join(dir, "gh.log");
    writeFileSync(ghLog, "");
    try {
      const result = runResolve(
        {
          AGENT_SECRET: "",
          AGENT_SECRET_OUT: out,
          DEV_TEAM_GITHUB_TOKEN: "fake-pat-do-not-log",
        },
        ghLog
      );
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(result.status).toBe(0);
      expect(readFileSync(out, "utf8").length).toBeGreaterThan(0);
      expect(combined).toMatch(/minted AGENT_SECRET/);
      expect(combined).not.toContain("fake-pat-do-not-log");
      const ghCalls = readFileSync(ghLog, "utf8");
      expect(ghCalls).toMatch(/argv: secret set AGENT_SECRET --app actions/);
      expect(ghCalls).not.toMatch(/--body-file/);
      expect(ghCalls).not.toMatch(/ -b /);
      expect(ghCalls).not.toMatch(/ --body /);
      expect(ghCalls).toMatch(/stdin_len=[1-9]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
