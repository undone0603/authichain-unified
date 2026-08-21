import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  plugins: [react()],
  resolve: {
    alias: [
      // src/ server-side aliases must come before the client/src catch-all so
      // that `@/db` and similar paths resolve to the server layer, not client.
      //
      // Why these are listed one by one rather than resolved like tsconfig
      // does it: tsconfig maps "@/*" to ["./src/*", "./client/src/*"] and takes
      // the first that exists, which is why `tsc --noEmit` resolves all of
      // these and vitest did not. Vite aliases have no such fallback — the
      // first matching `find` wins outright. Reordering the catch-all to
      // src/ would silently change which module two files resolve to
      // (lib/thirdweb.ts and lib/trpc.ts exist under both roots), so each
      // server-side path is carved out explicitly instead.
      {
        find: "@/../fixtures",
        replacement: path.resolve(templateRoot, "fixtures"),
      },
      {
        find: "@/lib/attestation",
        replacement: path.resolve(templateRoot, "src", "lib", "attestation"),
      },
      { find: "@/db", replacement: path.resolve(templateRoot, "src", "db") },
      { find: "@", replacement: path.resolve(templateRoot, "client", "src") },
      { find: "@shared", replacement: path.resolve(templateRoot, "shared") },
      {
        find: "@assets",
        replacement: path.resolve(templateRoot, "attached_assets"),
      },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    // protocol/ is the Apache-2.0 reference verifier and ships as plain .mjs so
    // anyone can run it without this repo's toolchain — hence the extra pattern.
    include: [
      "api/**/*.test.ts",
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "worker-app/**/*.test.ts",
      "scripts/**/*.test.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
      "workers/**/*.test.ts",
      "protocol/**/*.test.mjs",
    ],
  },
});
