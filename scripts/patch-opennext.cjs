#!/usr/bin/env node
/**
 * patch-opennext.cjs
 * Post-process the .open-next build output for Cloudflare Pages compatibility.
 * Runs AFTER `opennextjs-cloudflare build` as a post-build step.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OPEN_NEXT_DIR = path.join(ROOT, '.open-next');

/**
 * Patch a file in-place by applying a series of [search, replace] pairs.
 * Skips silently if the file doesn't exist.
 */
function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) return;
  let src = fs.readFileSync(filePath, 'utf8');
  for (const [search, replace] of patches) {
    src = src.split(search).join(replace);
  }
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`  patched: ${path.relative(ROOT, filePath)}`);
}

if (!fs.existsSync(OPEN_NEXT_DIR)) {
  console.error('[patch-opennext] ERROR: .open-next/ not found — run opennextjs-cloudflare build first');
  process.exit(1);
}

console.log('[patch-opennext] Starting OpenNext → Cloudflare Pages compatibility patches...');

// ── 1. Worker entry-point patches ───────────────────────────────────────────
const workerEntry = path.join(OPEN_NEXT_DIR, 'worker.js');
patchFile(workerEntry, [
  // Replace Node-only __dirname with import.meta shim (workers don't have __dirname)
  ['__dirname', 'globalThis.__dirname ?? "."'],
  // Replace Node-only __filename
  ['__filename', 'globalThis.__filename ?? "index.js"'],
]);

// ── 2. Server function patches ───────────────────────────────────────────────
const serverDir = path.join(OPEN_NEXT_DIR, 'server-functions', 'default');
if (fs.existsSync(serverDir)) {
  for (const file of fs.readdirSync(serverDir).filter(f => f.endsWith('.js'))) {
    patchFile(path.join(serverDir, file), [
      ['process.env.NEXT_RUNTIME', '"edge"'],
    ]);
  }
}

// ── 3. Remove unsupported Node.js built-ins from edge bundles ────────────────
const edgeDir = path.join(OPEN_NEXT_DIR, 'edge-functions');
if (fs.existsSync(edgeDir)) {
  for (const file of fs.readdirSync(edgeDir).filter(f => f.endsWith('.js'))) {
    patchFile(path.join(edgeDir, file), [
      ['require("crypto")', 'globalThis.crypto'],
    ]);
  }
}

// ── 4. Create _worker.js for Cloudflare Pages compatibility ─────────────────
// Cloudflare Pages requires the custom Worker to be named `_worker.js` in the
// build output directory. opennextjs-cloudflare outputs `worker.js` (Worker
// deployment convention), so we copy it to `_worker.js` for Pages.
if (fs.existsSync(workerEntry)) {
  const pagesWorker = path.join(OPEN_NEXT_DIR, '_worker.js');
  fs.copyFileSync(workerEntry, pagesWorker);
  console.log(`  created: ${path.relative(ROOT, pagesWorker)} (Cloudflare Pages _worker.js)`);

  // Also place _worker.js in assets/ in case that is the Pages output directory
  const assetsWorker = path.join(OPEN_NEXT_DIR, 'assets', '_worker.js');
  if (fs.existsSync(path.join(OPEN_NEXT_DIR, 'assets'))) {
    fs.copyFileSync(workerEntry, assetsWorker);
    console.log(`  created: ${path.relative(ROOT, assetsWorker)}`);
  }
}

// ── 5. Copy .open-next/assets/ → dist/ for CF Pages output dir ──────────────
// CF Pages reads wrangler.toml; if it lacks `pages_build_output_dir` it skips
// the file and uses the dashboard-configured output dir, which defaults to
// `dist`. Copy assets here so CF Pages finds the output without touching
// wrangler.toml (which is shared with the authichain-unified Pages project).
const assetsDir = path.join(OPEN_NEXT_DIR, 'assets');
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, distDir, { recursive: true });
  console.log(`  copied: ${path.relative(ROOT, assetsDir)} → ${path.relative(ROOT, distDir)}`);
}

console.log('[patch-opennext] Done.');
