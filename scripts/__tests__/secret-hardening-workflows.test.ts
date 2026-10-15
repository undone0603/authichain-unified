import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowsRoot = join(repoRoot, ".github", "workflows");

function readWorkflow(name: string): string {
  return readFileSync(join(workflowsRoot, name), "utf8");
}

function gitleaksAllowlistPaths(config: string): string[] {
  const allowlist = config.match(
    /\[allowlist\]([\s\S]*?)(?=\n\[\[|\n\[[^\[]|$)/
  )?.[1];
  expect(allowlist).toBeDefined();

  const paths = allowlist!.match(/paths\s*=\s*\[([\s\S]*?)\]/)?.[1];
  expect(paths).toBeDefined();

  return [...paths!.matchAll(/'''([\s\S]*?)'''/g)].map(
    ([, pattern]) => pattern
  );
}

function assertNoDispatchSecretInputs(workflow: string) {
  expect(workflow).not.toMatch(
    /workflow_dispatch:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+inputs:/
  );
}

function assertSecretEnvSource(workflow: string, variable: string) {
  expect(workflow).toMatch(
    new RegExp(
      `\\b${variable}:\\s*\\$\\{\\{\\s*secrets\\.[A-Z0-9_]+\\s*\\}\\}`
    )
  );
}

function assertPrintfSecretPipes(workflow: string) {
  const puts = workflow
    .split("\n")
    .filter((line) => /\bwrangler secret put\b/.test(line));
  expect(puts).not.toHaveLength(0);
  for (const put of puts) {
    expect(put).toContain("printf '%s'");
  }
}

describe("secret-hardening configuration", () => {
  it("extends the Gitleaks defaults without allowlisting environment templates", () => {
    const config = readFileSync(join(repoRoot, ".gitleaks.toml"), "utf8");

    expect(config).toMatch(/\[extend\]\s*\nuseDefault\s*=\s*true/);
    const allowlistPaths = gitleaksAllowlistPaths(config);
    for (const template of [
      ".env.template",
      ".env.example",
      ".env.local.example",
    ]) {
      expect(
        allowlistPaths.some((pattern) => new RegExp(pattern).test(template))
      ).toBe(false);
    }
  });
});

describe("manual secret-binding workflows", () => {
  const bindings = [
    {
      file: "bind-lead-secrets.yml",
      variables: ["CLOUDFLARE_API_TOKEN", "HUBSPOT_ACCESS_TOKEN"],
      requiredGuard: /for required in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID/,
    },
    {
      file: "bind-stripe-webhook-secrets.yml",
      variables: ["CLOUDFLARE_API_TOKEN", "STRIPE_WEBHOOK_SECRET"],
      requiredGuard: /Neither STRIPE_WEBHOOK_AUTHICHAIN_SECRET nor STRIPE_WEBHOOK_SECRET is set/,
    },
    {
      file: "set-outreach-resend-secret.yml",
      variables: ["CLOUDFLARE_API_TOKEN", "RESEND_KEY"],
      requiredGuard: /for required in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID RESEND_KEY/,
    },
    {
      file: "set-outreach-secret.yml",
      variables: ["CLOUDFLARE_API_TOKEN", "AUTH_TOKEN", "RESEND_API_KEY"],
      requiredGuard: /for required in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID AUTH_TOKEN/,
    },
  ] as const;

  for (const { file, variables, requiredGuard } of bindings) {
    it(`${file} binds values from GitHub Secrets without dispatch inputs`, () => {
      const workflow = readWorkflow(file);

      assertNoDispatchSecretInputs(workflow);
      for (const variable of variables) {
        assertSecretEnvSource(workflow, variable);
      }
      expect(workflow).toMatch(requiredGuard);
      assertPrintfSecretPipes(workflow);
    });
  }
});

describe("AgentZ credential recovery hardening", () => {
  const credentialWorkflows = [
    "bind-claw-agentz-url.yml",
    "agentz-tunnel-bringup.yml",
    "set-agentz-claw-secrets.yml",
  ] as const;

  it.each(credentialWorkflows)(
    "%s never transfers active credentials through workflow artifacts",
    (file) => {
      const workflow = readWorkflow(file);

      expect(workflow).not.toMatch(/actions\/(?:upload|download)-artifact@/);
    }
  );

  it("binds the claw key only to the fixed production origin", () => {
    const workflow = readWorkflow("bind-claw-agentz-url.yml");

    assertNoDispatchSecretInputs(workflow);
    expect(workflow).not.toMatch(/github\.event\.inputs\.agentz_url/);
    expect(workflow).toMatch(
      /AGENTZ_API_URL:\s*https:\/\/agentz\.authichain\.com/
    );
    expect(workflow).toMatch(
      /EXPECTED_AGENTZ_API_URL="https:\/\/agentz\.authichain\.com"/
    );
    expect(workflow).toMatch(
      /if \[ "\$AGENTZ_API_URL" != "\$EXPECTED_AGENTZ_API_URL" \]/
    );
    expect(workflow).toMatch(/--max-redirs 0/);
    expect(workflow).toMatch(/AGENTZ_API_URL must not redirect/);
    expect(workflow).toMatch(/AGENT_SECRET is empty/);
  });

  it("keeps operator guidance artifact-free after a secret is minted", () => {
    const resolver = readFileSync(
      join(repoRoot, "scripts", "agentz-tunnel", "resolve-agent-secret.sh"),
      "utf8"
    );

    expect(resolver).toContain("directly on the owner box");
    expect(resolver).not.toMatch(/download .*artifact/i);
  });
});
