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
    expect(page).toContain("unavailable");
    expect(page).not.toContain("item.tx.slice");
  });

  it("does not call the dead Polygon RPC or claim full history", () => {
    const source = read("workers/manufacturer-status/src/index.ts");
    expect(source).not.toContain("polygon-rpc.com");
    expect(source).not.toContain("polygon.drpc.org");
    expect(source).toContain("polygon-bor-rpc.publicnode.com");
    expect(source).not.toContain("Full on-chain");
    expect(source).toContain("isManufacturerVerified");
    expect(source).toContain("HISTORY_DISCLAIMER");
    const windowSrc = read("workers/manufacturer-status/src/window.ts");
    expect(windowSrc).toContain("latest 10,000 Polygon blocks");
    expect(windowSrc).toContain("not the full history");
  });

  it("does not store the dead Polygon RPC as a worker secret", () => {
    const workflow = read(".github/workflows/deploy-manufacturer-status.yml");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("--keep-vars");
    expect(workflow).not.toContain("polygon-rpc.com");
    expect(workflow).not.toContain("secret put");
  });

  it("answers the apex history path before the app proxy", () => {
    const index = read("workers/authichain-com/src/index.ts");
    const call = index.indexOf("tryHandleManufacturerStatus(request)");
    const proxy = index.indexOf("APP_PREFIXES.some");
    expect(call).toBeGreaterThan(-1);
    expect(proxy).toBeGreaterThan(call);
    const route = read("workers/authichain-com/src/manufacturer-status-route.ts");
    expect(route).toContain("/api/manufacturer-status/");
    expect(route).toContain("/verify/manufacturer");
    expect(route).toContain('const RPC = "https://polygon-bor-rpc.publicnode.com"');
    expect(route).not.toContain("https://polygon-rpc.com");
    expect(route).not.toContain("https://polygon.drpc.org");
    expect(route).not.toContain("$49");
    expect(route).not.toContain("auto-granted");
  });
});
