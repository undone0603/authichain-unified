// Unified assets merge.
//
// Merges the Vite SPA build (`dist/public/`) with the Next.js marketing
// static snapshot (`dist/marketing/`, produced by
// `scripts/build-marketing-snapshot.mjs`) into a single assets root
// (`dist/site/`) suitable for Cloudflare's single-directory `[assets]`
// binding.
//
// `mergeAssets` is a pure fs transform: it never shells out, so it is
// testable against a fixture tree. The CLI entry point (guarded below) is
// what actually runs it against the real `dist/public` + `dist/marketing`
// build outputs.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Files at the marketing snapshot root that must NOT overlay onto the SPA
// base layer: the SPA's `robots.txt`/`sitemap.xml` are brand-aware and win,
// and `marketing-manifest.json` is copied explicitly in its own step.
const MKT_ROOT_SKIP = new Set([
  "robots.txt",
  "sitemap.xml",
  "marketing-manifest.json",
]);

/**
 * Recursively copy `srcDir` into `destDir`, skipping any top-level entry of
 * `srcDir` whose name is in `skipRootNames`.
 */
async function copyDirSkippingRoot(srcDir, destDir, skipRootNames) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  await fsp.mkdir(destDir, { recursive: true });

  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipRootNames.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    await fsp.cp(srcPath, destPath, { recursive: true });
  }
}

/**
 * Pure fs transform: merge the SPA build and the marketing snapshot into a
 * single Cloudflare assets root.
 *
 * @param {object} opts
 * @param {string} opts.spaDir - path to the Vite SPA build output (base layer).
 * @param {string} opts.mktDir - path to the marketing static snapshot (overlay).
 * @param {string} opts.outDir - path to write the merged assets root into.
 */
export async function mergeAssets({ spaDir, mktDir, outDir }) {
  // 1. Wipe outDir, then copy the SPA build in as the base layer (keeps
  // index.html, assets/, robots.txt, sitemap.xml, everything else).
  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });
  await copyDirSkippingRoot(spaDir, outDir, new Set());

  // 2. Overlay the marketing snapshot, skipping the mkt-root robots.txt /
  // sitemap.xml (SPA versions win) and marketing-manifest.json (copied
  // explicitly below). All *.html and _next/** overlay in as-is.
  await copyDirSkippingRoot(mktDir, outDir, MKT_ROOT_SKIP);

  // 3. Copy the marketing manifest to the merged root explicitly.
  const manifestSrc = path.join(mktDir, "marketing-manifest.json");
  if (fs.existsSync(manifestSrc)) {
    await fsp.copyFile(manifestSrc, path.join(outDir, "marketing-manifest.json"));
  }
}

// CLI entry point: merge the real `dist/public` (Vite SPA) and
// `dist/marketing` (Next marketing snapshot) build outputs into `dist/site`.
const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const spaDir = "dist/public";
  const mktDir = "dist/marketing";
  const outDir = "dist/site";

  await mergeAssets({ spaDir, mktDir, outDir });
  console.log(`[merge-assets] merged ${spaDir} + ${mktDir} -> ${outDir}`);
}
