#!/usr/bin/env node
/**
 * patch-opennext.cjs
 * Post-process the .open-next build output for Cloudflare Pages compatibility.
 * Runs as the first step of `pnpm cf:build` before `opennextjs-cloudflare build`.
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

console.log('[patch-opennext] Starting OpenNext → Cloudflare compatibility patches...');

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
      // Cloudflare Workers use globalThis instead of process for some globals
      ['process.env.NEXT_RUNTIME', '"edge"'],
    ]);
  }
}

// ── 3. Remove unsupported Node.js built-ins from edge bundles ────────────────
const edgeDir = path.join(OPEN_NEXT_DIR, 'edge-functions');
if (fs.existsSync(edgeDir)) {
  for (const file of fs.readdirSync(edgeDir).filter(f => f.endsWith('.js'))) {
    patchFile(path.join(edgeDir, file), [
      // Patch out any stray crypto.createHash references that aren't available in edge
      ['require("crypto")', 'globalThis.crypto'],
    ]);
  }
}

console.log('[patch-opennext] Done.');
