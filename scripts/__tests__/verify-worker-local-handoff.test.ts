import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const path = "scripts/ops/verify-worker-local-secret-handoff.sh";
const source = readFileSync(path, "utf8");

describe("verify Worker local secret handoff", () => {
  it("passes a syntax-only Bash check without executing its actions", () => {
    const check = spawnSync("bash", ["-n", path], { encoding: "utf8" });
    expect(check.status, check.stderr).toBe(0);
  });

  it("refuses missing or unprotected GitHub environments before prompting", () => {
    const environmentGate = source.indexOf('gh api --method GET "repos/$REPO/environments/$ENVIRONMENT"');
    const tokenPrompt = source.indexOf('read -r -s -p "New account-owned Cloudflare token');
    expect(environmentGate).toBeGreaterThan(0);
    expect(tokenPrompt).toBeGreaterThan(environmentGate);
    expect(source).toContain("env.deployment_branch_policy?.protected_branches !== true");
    expect(source).toContain("env.deployment_branch_policy?.custom_branch_policies !== false");
    expect(source).toContain("env.can_admins_bypass !== false");
  });

  it("writes only the dedicated environment secrets through stdin", () => {
    expect(source).toContain('gh secret set "$TOKEN_SECRET" --env "$ENVIRONMENT" --repo "$REPO"');
    expect(source).toContain('gh secret set "$ACCOUNT_SECRET" --env "$ENVIRONMENT" --repo "$REPO"');
    expect(source).not.toContain("AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN");
    expect(source).not.toContain("gh secret set --body");
    expect(source).toContain('EXISTING="$(gh secret list -e "$ENVIRONMENT"');
  });

  it("does not deploy, publish, create Cloudflare tokens, or forge permission attestations", () => {
    expect(source).toContain('set +x');
    expect(source).toContain('[[ -t 0 && -r /dev/tty ]]');
    expect(source).toContain('/accounts/" + account + "/tokens/verify');
    expect(source).toContain('/workers/scripts/" + worker + "/deployments');
    expect(source).not.toContain("wrangler deploy");
    expect(source).not.toContain("gh workflow run");
    expect(source).not.toContain(".github/credential-policies/authichain-verify-worker.json");
    expect(source).toContain("independent token-detail audit");
  });
});
