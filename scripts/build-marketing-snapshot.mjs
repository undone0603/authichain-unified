// Marketing static-snapshot extractor.
//
// Walks a Next.js `.next/server/app/**/*.html` tree produced by `next build`
// and copies the surviving (non-dynamic, non-api) prerendered marketing pages
// into a flat static-assets output directory, alongside the `_next/static`
// chunks they depend on. Emits a `marketing-manifest.json` listing every
// route that made it into the snapshot.
//
// `buildMarketingSnapshot` is a pure fs transform: it never invokes `next`
// itself, so it is testable against a fixture tree. The CLI entry point
// (guarded below) is what actually runs `next build` before calling it.

import { execSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The 16 dynamic / non-static routes identified by the Task 2.1 spec. These
// are owned by the SPA or by lean Hono handlers (Task 3.1+), never by the
// marketing static snapshot.
export const DEFAULT_EXCLUDE_ROUTES = [
  "/",
  "/admin/products",
  "/auth/callback",
  "/billing/upgrade-required",
  "/brand/qron/artwork/[id]",
  "/dashboard",
  "/dashboard/qron/[id]",
  "/gallery",
  "/grants",
  "/og",
  "/reveal/[id]",
  "/robots.txt",
  "/s/[shortcode]",
  "/sitemap.xml",
  "/status",
  "/verify",
];

/**
 * Recursively collect every file under `dir`, returning paths relative to
 * `dir` using POSIX separators (so route derivation is platform-independent).
 */
async function walkFiles(dir) {
  const results = [];

  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(dir, fullPath).split(path.sep).join("/");
        results.push(rel);
      }
    }
  }

  if (fs.existsSync(dir)) {
    await walk(dir);
  }

  return results;
}

/**
 * Derive a route path from a `server/app`-relative html file path.
 * e.g. "about.html" -> "/about"
 *      "authichain/about.html" -> "/authichain/about"
 *      "foo/index.html" -> "/foo"
 *      "index.html" -> "/"
 */
function routeFromRelativeHtmlPath(relPath) {
  let withoutExt = relPath.replace(/\.html$/, "");
  if (withoutExt === "index") {
    withoutExt = "";
  } else if (withoutExt.endsWith("/index")) {
    withoutExt = withoutExt.slice(0, -"/index".length);
  }
  return "/" + withoutExt;
}

/**
 * Pure fs transform: given a `.next` build directory, copy the surviving
 * marketing routes + static chunks into `outDir` and write a manifest.
 *
 * @param {object} opts
 * @param {string} opts.nextDir - path to the `.next` build output directory.
 * @param {string} opts.outDir - path to write the marketing snapshot into.
 * @param {string[]} [opts.excludeRoutes] - route paths to exclude (defaults
 *   to the 16 dynamic routes owned by the SPA / Hono handlers).
 * @returns {Promise<{ routes: string[] }>} the manifest that was written.
 */
export async function buildMarketingSnapshot({
  nextDir,
  outDir,
  excludeRoutes = DEFAULT_EXCLUDE_ROUTES,
}) {
  const appDir = path.join(nextDir, "server", "app");
  const staticSrcDir = path.join(nextDir, "static");
  const excludeSet = new Set(excludeRoutes);

  await fsp.mkdir(outDir, { recursive: true });

  const htmlFiles = (await walkFiles(appDir)).filter((rel) =>
    rel.endsWith(".html"),
  );

  const routes = [];

  for (const rel of htmlFiles) {
    const segments = rel.split("/");
    // Exclude anything under an `api/` segment — never a marketing page.
    if (segments.includes("api")) {
      continue;
    }

    const route = routeFromRelativeHtmlPath(rel);
    if (excludeSet.has(route)) {
      continue;
    }

    const srcPath = path.join(appDir, ...rel.split("/"));
    const destPath = path.join(outDir, ...rel.split("/"));
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.copyFile(srcPath, destPath);

    routes.push(route);
  }

  // Copy `.next/static/**` -> `outDir/_next/static/**` verbatim.
  if (fs.existsSync(staticSrcDir)) {
    const staticDestDir = path.join(outDir, "_next", "static");
    await fsp.cp(staticSrcDir, staticDestDir, { recursive: true });
  }

  routes.sort();
  const manifest = { routes };

  await fsp.writeFile(
    path.join(outDir, "marketing-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );

  return manifest;
}

// CLI entry point: run `next build` then extract the marketing snapshot from
// the resulting `.next` directory into `dist/marketing`.
const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  execSync("next build", { stdio: "inherit" });
  const manifest = await buildMarketingSnapshot({
    nextDir: ".next",
    outDir: "dist/marketing",
  });
  console.log(
    `[build-marketing-snapshot] wrote ${manifest.routes.length} routes to dist/marketing/`,
  );
}
