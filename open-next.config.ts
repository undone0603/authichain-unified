import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';

// ISR surface is tiny (dashboard revalidate=60, grants revalidate=300), so a
// single KV namespace is plenty. Everything else is force-dynamic.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  // Requested: keep playwright-core / chromium-bidi out of the Worker bundle.
  // Note: @opennextjs/cloudflare 1.20.6 does not read an `external` key; its
  // server esbuild externals are hardcoded (dist/cli/build/bundle-server.js),
  // and a local `opennextjs-cloudflare build` still fails with it set.
  external: ["playwright-core", "chromium-bidi"],
});
