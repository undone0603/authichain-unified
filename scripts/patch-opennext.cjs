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

const patched = `  "react-dom/server.edge",\n  "ioredis",\n  "redis",\n];`;
const original = `  "react-dom/server.edge",\n];`;

try {
  let content = fs.readFileSync(bundleServerPath, 'utf8');

  if (content.includes(patched)) {
    console.log('[patch-opennext] Already patched — skipping.');
    process.exit(0);
  }

  if (!content.includes(original)) {
    console.error(
      '[patch-opennext] Could not locate target in bundle-server.js — package may have been updated. Review manually.'
    );
    process.exit(1);
  }

  const updated = content.replace(original, patched);
  // Write atomically to a temp file then rename to avoid TOCTOU race conditions
  const tmpPath = bundleServerPath + '.tmp';
  fs.writeFileSync(tmpPath, updated, 'utf8');
  fs.renameSync(tmpPath, bundleServerPath);

  console.log('[patch-opennext] Patched bundle-server.js: ioredis + redis added to optionalDependencies');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('[patch-opennext] bundle-server.js not found at', bundleServerPath);
    process.exit(1);
  }
  throw err;
}
