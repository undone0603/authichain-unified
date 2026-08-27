import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildMarketingSnapshot } from "../build-marketing-snapshot.mjs";

describe("buildMarketingSnapshot", () => {
  let tmpRoot: string;
  let nextDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketing-snapshot-"));
    nextDir = path.join(tmpRoot, ".next");
    outDir = path.join(tmpRoot, "dist", "marketing");

    const appDir = path.join(nextDir, "server", "app");
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(path.join(appDir, "authichain"), { recursive: true });
    fs.mkdirSync(path.join(appDir, "api", "webhook"), { recursive: true });
    fs.mkdirSync(path.join(appDir, "gallery"), { recursive: true });

    fs.writeFileSync(path.join(appDir, "about.html"), "<html>about</html>");
    fs.writeFileSync(
      path.join(appDir, "authichain", "about.html"),
      "<html>authichain about</html>",
    );
    // Should be excluded: lives under api/, never a marketing page.
    fs.writeFileSync(
      path.join(appDir, "api", "webhook", "route.html"),
      "<html>should be excluded</html>",
    );
    // Should be excluded: matches a default dynamic route (/gallery).
    fs.writeFileSync(path.join(appDir, "gallery.html"), "<html>gallery</html>");

    const staticDir = path.join(nextDir, "static", "chunks");
    fs.mkdirSync(staticDir, { recursive: true });
    fs.writeFileSync(path.join(staticDir, "x.js"), "console.log('x')");
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("copies surviving html routes into outDir, preserving nested dirs", async () => {
    await buildMarketingSnapshot({ nextDir, outDir });

    expect(fs.existsSync(path.join(outDir, "about.html"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "authichain", "about.html"))).toBe(
      true,
    );
  });

  it("excludes routes under api/", () => {
    return buildMarketingSnapshot({ nextDir, outDir }).then(() => {
      expect(
        fs.existsSync(path.join(outDir, "api", "webhook", "route.html")),
      ).toBe(false);
    });
  });

  it("excludes default dynamic routes such as /gallery", async () => {
    await buildMarketingSnapshot({ nextDir, outDir });
    expect(fs.existsSync(path.join(outDir, "gallery.html"))).toBe(false);
  });

  it("copies nextDir/static/** verbatim into outDir/_next/static/**", async () => {
    await buildMarketingSnapshot({ nextDir, outDir });
    expect(
      fs.existsSync(path.join(outDir, "_next", "static", "chunks", "x.js")),
    ).toBe(true);
  });

  it("writes a manifest with the surviving marketing routes", async () => {
    const manifest = await buildMarketingSnapshot({ nextDir, outDir });

    expect(manifest.routes).toContain("/about");
    expect(manifest.routes).toContain("/authichain/about");
    expect(manifest.routes).not.toContain("/");
    expect(manifest.routes).not.toContain("/gallery");

    const manifestPath = path.join(outDir, "marketing-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(written).toEqual(manifest);
  });

  it("respects a custom excludeRoutes override", async () => {
    const manifest = await buildMarketingSnapshot({
      nextDir,
      outDir,
      excludeRoutes: [], // don't exclude anything, including default dynamic routes
    });
    expect(manifest.routes).toContain("/gallery");
    expect(fs.existsSync(path.join(outDir, "gallery.html"))).toBe(true);
  });
});
