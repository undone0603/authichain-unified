import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // Explicitly call next build rather than the pnpm `build` script to
  // prevent infinite recursion when the build script is opennextjs-cloudflare itself.
  buildCommand: "next build",
};
