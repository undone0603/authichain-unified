import { defineCloudflareConfig } from "@opennextjs/cloudflare";

<<<<<<< HEAD
export default {
  ...defineCloudflareConfig({}),
  // opennextjs-cloudflare build internally calls buildCommand to compile Next.js.
  // Using "pnpm run" here hits a corepack version-mismatch error on CF Pages
  // (packageManager=pnpm@10.11.1 vs installed pnpm@11.x). Invoke next directly
  // via node_modules/.bin to bypass pnpm/corepack entirely.
  buildCommand: "node_modules/.bin/next build",
};
=======
export default defineCloudflareConfig();
>>>>>>> origin/add-agentz-editable
