import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({}),
  // Prevent circular dependency: opennextjs-cloudflare build internally calls
  // the buildCommand to run Next.js. If buildCommand = "pnpm build" and the
  // "build" script is "opennextjs-cloudflare build", that creates a loop.
  // Use a dedicated "build:next" script instead.
  buildCommand: "pnpm run build:next",
};
