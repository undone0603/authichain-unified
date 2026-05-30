/**
 * Patches @opennextjs/cloudflare's bundle-server.js to treat ioredis and redis
 * as optional dependencies (stubbed out rather than causing a hard esbuild failure).
 *
 * These packages are dynamically required by @upstash/ratelimit but are webpack-aliased
 * to stubs in next.config.ts. OpenNext's esbuild bundler doesn't honour webpack aliases,
 * so we add them to its own optionalDependencies list instead.
 *
 * Run automatically as part of `pnpm cf:build`.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const bundleServerPath = path.join(
  __dirname,
  '../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js'
);

if (!fs.existsSync(bundleServerPath)) {
  console.error('[patch-opennext] bundle-server.js not found at', bundleServerPath);
  process.exit(1);
}

let content = fs.readFileSync(bundleServerPath, 'utf8');

const patched = `    "react-dom/server.edge",\n    "ioredis",\n    "redis",\n];`;
if (content.includes(patched)) {
  console.log('[patch-opennext] Already patched — skipping.');
  process.exit(0);
}

const original = `    "react-dom/server.edge",\n];`;
if (!content.includes(original)) {
  console.error('[patch-opennext] Could not locate target in bundle-server.js — package may have been updated. Review manually.');
  process.exit(1);
}

content = content.replace(original, patched);
fs.writeFileSync(bundleServerPath, content, 'utf8');
console.log('[patch-opennext] Patched bundle-server.js: ioredis + redis added to optionalDependencies');
