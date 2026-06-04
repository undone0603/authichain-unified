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

// ── 2.5. Patch handler.mjs: add node: prefix to bare Node built-in requires ─
// The CF Pages wrangler bundler is invoked from the project root and cannot
// find a valid pages wrangler.toml (both Pages projects share the root
// wrangler.toml, but their output dirs differ so pages_build_output_dir can't
// be set for both). Without nodejs_compat the bundler can't resolve bare names
// like require("fs"). Using the "node:" prefix is flag-free and always works.
const handlerMjs = path.join(serverDir, 'handler.mjs');
patchFile(handlerMjs, [
  ['require("async_hooks")', 'require("node:async_hooks")'],
  ['require("buffer")',      'require("node:buffer")'],
  ['require("crypto")',      'require("node:crypto")'],
  ['require("events")',      'require("node:events")'],
  ['require("fs")',          'require("node:fs")'],
  ['require("http")',        'require("node:http")'],
  ['require("https")',       'require("node:https")'],
  ['require("os")',          'require("node:os")'],
  ['require("path")',        'require("node:path")'],
  ['require("stream")',      'require("node:stream")'],
  ['require("url")',         'require("node:url")'],
  ['require("util")',        'require("node:util")'],
  ['require("vm")',          'require("node:vm")'],
]);

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

// ── 5. Build dist/ for CF Pages output directory ────────────────────────────
// CF Pages (wrangler 3.x) finds _worker.js in the output dir and bundles it,
// resolving all relative imports from the same directory. The opennext worker
// imports ./cloudflare/, ./middleware/, ./server-functions/, ./.build/ — those
// modules must be co-located with _worker.js. Static assets must also be at
// the output root (not in ./assets/) for correct URL-path serving via ASSETS KV.
//
// Structure produced:
//   dist/_worker.js          ← patched .open-next/worker.js
//   dist/cloudflare/         ← worker runtime modules (bundled by wrangler)
//   dist/middleware/         ← middleware handler (bundled by wrangler)
//   dist/server-functions/   ← server function (bundled by wrangler)
//   dist/.build/             ← durable objects (bundled by wrangler)
//   dist/_next/              ← static chunks from .open-next/assets/_next/
//   dist/[other static]      ← anything else in .open-next/assets/
const assetsDir = path.join(OPEN_NEXT_DIR, 'assets');
const distDir = path.join(ROOT, 'dist');

// Recreate dist/ clean
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy worker module dependencies so wrangler can bundle _worker.js.
// dereference:true resolves symlinks to real files — CF Pages rejects output
// dirs containing symlinks that point outside the directory.
for (const dep of ['cloudflare', 'middleware', 'server-functions', '.build']) {
  const src = path.join(OPEN_NEXT_DIR, dep);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(distDir, dep), { recursive: true, dereference: true });
  }
}

// Place _worker.js at dist/ root (CF Pages custom-worker entry point)
if (fs.existsSync(workerEntry)) {
  fs.copyFileSync(workerEntry, path.join(distDir, '_worker.js'));
  console.log('  created: dist/_worker.js');
}

// Flatten .open-next/assets/ to dist/ root (skip the _worker.js placed there
// by step 4 — we already have the correct one from workerEntry above)
if (fs.existsSync(assetsDir)) {
  for (const entry of fs.readdirSync(assetsDir)) {
    if (entry === '_worker.js') continue;
    fs.cpSync(path.join(assetsDir, entry), path.join(distDir, entry), { recursive: true, dereference: true });
  }
  console.log('  flattened: .open-next/assets/ → dist/');
}

console.log('[patch-opennext] Done.');
