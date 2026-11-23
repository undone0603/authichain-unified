import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(".github/workflows/deploy-authichain-verify-worker-protected.yml", "utf8");

describe("verify Worker credential isolation", () => {
  it("uses only the dedicated protected environment, never the authichain-com environment", () => {
    expect(source).toContain("name: production-cloudflare-verify-worker");
    expect(source).toContain("/environments/production-cloudflare-verify-worker");
    expect(source).not.toContain("name: production-cloudflare\n");
    expect(source).not.toContain("/environments/production-cloudflare'");
  });
  it("never falls back to shared production token or account secrets", () => {
    expect(source).toContain("secrets.AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_API_TOKEN");
    expect(source).toContain("secrets.AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_ACCOUNT_ID");
    expect(source).not.toContain("secrets.AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN");
    expect(source).not.toContain("secrets.AUTHICHAIN_PRODUCTION_CLOUDFLARE_ACCOUNT_ID");
  });
  it("requires account-owned token, target Worker read and independent policy match before publish", () => {
    expect(source).toContain("/tokens/verify");
    expect(source).toContain("'authichain-verify-worker'");
    expect(source).toContain("token_kind !== 'account-owned'");
    expect(source).toContain("scope !== 'Specified Workers'");
    expect(source).toContain("role !== 'Editor'");
    expect(source).toContain("additional_permissions.length !== 0");
    expect(source).toContain(".github/credential-policies/authichain-verify-worker.json");
    expect(source.indexOf("Confirm isolated account token and independently reviewed scope")).toBeLessThan(source.indexOf("Deploy only authichain-verify-worker"));
  });
  it("retains exact-SHA, protected-branch, manual-only and non-bypass guards", () => {
    expect(source).toContain("workflow_dispatch:");
    expect(source).not.toMatch(/^\s+push:/m);
    expect(source).toContain("can_admins_bypass!==false");
    expect(source).toContain("branch.protected!==true");
    expect(source).toContain("test \"$REMOTE_MAIN\" = \"$EXPECTED_SHA\"");
    expect(source).toContain("ci/circleci: main-quality-gate");
  });
});
