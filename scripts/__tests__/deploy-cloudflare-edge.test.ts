import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Deploy to Cloudflare still publishes the edge router", () => {
  const deploy = read(".github/workflows/deploy-cloudflare.yml");

  it("publishes worker-app and the scan worker, then smokes", () => {
    expect(deploy).toContain("working-directory: worker-app");
    expect(deploy).toContain("name: Publish application Worker + Assets");
    expect(deploy).toContain(
      "npx wrangler deploy --minify --keep-vars --config wrangler.toml"
    );
    expect(deploy).toContain("workers/authichain-scan-validate");
    expect(deploy).toContain("post-deploy-smoke:");
    expect(deploy).toContain("scripts/ci/post-deploy-smoke.mjs");
    expect(deploy).toContain("runs-on: ubuntu-24.04");
    expect(deploy).not.toContain("runs-on: ubuntu-latest");
  });

  it("keeps the manufacturer worker on the same push deploy", () => {
    expect(deploy).toContain("name: Deploy manufacturer-status");
    expect(deploy).toContain("working-directory: workers/manufacturer-status");
    expect(deploy).toContain("npx wrangler deploy --minify");
  });
});
