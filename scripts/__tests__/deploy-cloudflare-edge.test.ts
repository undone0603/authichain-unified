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
    expect(deploy).toContain("workers/authichain-scan-validate");
    expect(deploy).toContain("post-deploy-smoke:");
    expect(deploy).toContain("scripts/ci/post-deploy-smoke.mjs");
  });

  it("does not replace that job with the manufacturer worker", () => {
    expect(deploy).not.toContain("workers/manufacturer-status");
  });
});

describe("manufacturer-status stays off the public workers.dev host", () => {
  it("sets workers_dev and preview_urls false", () => {
    const toml = read("workers/manufacturer-status/wrangler.toml");
    expect(toml).toContain("workers_dev = false");
    expect(toml).toContain("preview_urls = false");
  });

  it("does not sell an auto-granted role", () => {
    const page = read("src/app/verify/manufacturer/page.tsx");
    expect(page).not.toContain("auto-granted");
    expect(page).not.toContain("$49");
    expect(page).toContain("does not take payment");
    expect(page).toContain("latest 10,000 blocks");
  });

  it("does not call the dead Polygon RPC or claim full history", () => {
    const source = read("workers/manufacturer-status/src/index.ts");
    expect(source).not.toContain("polygon-rpc.com");
    expect(source).toContain("polygon.drpc.org");
    expect(source).not.toContain("Full on-chain");
    expect(source).toContain("latest 10,000 Polygon blocks");
  });
});
