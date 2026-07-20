import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';

// ISR surface is tiny (dashboard revalidate=60, grants revalidate=300), so a
// single KV namespace is plenty. Everything else is force-dynamic.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
