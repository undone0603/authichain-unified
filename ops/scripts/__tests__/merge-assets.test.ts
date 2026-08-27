import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mergeAssets } from "../merge-assets.mjs";

describe("mergeAssets", () => {
  let tmpRoot: string;
  let spaDir: string;
  let mktDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "merge-assets-"));
    spaDir = path.join(tmpRoot, "dist", "public");
    mktDir = path.join(tmpRoot, "dist", "marketing");
    outDir = path.join(tmpRoot, "dist", "site");

    fs.mkdirSync(path.join(spaDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(spaDir, "index.html"), "<html>spa shell</html>");
    fs.writeFileSync(path.join(spaDir, "assets", "app.js"), "console.log('spa')");
    fs.writeFileSync(path.join(spaDir, "robots.txt"), "spa robots");
    fs.writeFileSync(path.join(spaDir, "sitemap.xml"), "<urlset>spa</urlset>");

    fs.mkdirSync(path.join(mktDir, "_next", "static"), { recursive: true });
    fs.writeFileSync(path.join(mktDir, "about.html"), "<html>about</html>");
    fs.writeFileSync(path.join(mktDir, "_next", "static", "x.js"), "console.log('x')");
    fs.writeFileSync(path.join(mktDir, "robots.txt"), "marketing robots");
    fs.writeFileSync(path.join(mktDir, "sitemap.xml"), "<urlset>marketing</urlset>");
    fs.writeFileSync(
      path.join(mktDir, "marketing-manifest.json"),
      JSON.stringify({ routes: ["/about"] }, null, 2) + "\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function read(p: string) {
    return fs.readFileSync(p, "utf8");
  }

  it("preserves the SPA shell at outDir/index.html", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(read(path.join(outDir, "index.html"))).toBe(
      read(path.join(spaDir, "index.html")),
    );
  });

  it("copies SPA assets/**", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(fs.existsSync(path.join(outDir, "assets", "app.js"))).toBe(true);
  });

  it("overlays marketing html pages", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(fs.existsSync(path.join(outDir, "about.html"))).toBe(true);
  });

  it("overlays _next/static chunks", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(fs.existsSync(path.join(outDir, "_next", "static", "x.js"))).toBe(
      true,
    );
  });

  it("keeps the SPA robots.txt (marketing version dropped)", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(read(path.join(outDir, "robots.txt"))).toBe(
      read(path.join(spaDir, "robots.txt")),
    );
  });

  it("keeps the SPA sitemap.xml (marketing version dropped)", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    expect(read(path.join(outDir, "sitemap.xml"))).toBe(
      read(path.join(spaDir, "sitemap.xml")),
    );
  });

  it("copies marketing-manifest.json to outDir root", async () => {
    await mergeAssets({ spaDir, mktDir, outDir });
    const manifestPath = path.join(outDir, "marketing-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(JSON.parse(read(manifestPath))).toEqual({ routes: ["/about"] });
  });

  it("wipes any pre-existing outDir before merging", async () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "stale.html"), "stale");

    await mergeAssets({ spaDir, mktDir, outDir });

    expect(fs.existsSync(path.join(outDir, "stale.html"))).toBe(false);
  });
});
