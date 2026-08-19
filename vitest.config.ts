import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // protocol/ is the Apache-2.0 reference verifier and ships as plain .mjs so
    // anyone can run it without this repo's toolchain — hence the extra pattern.
    include: ["api/**/*.test.ts", "server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "worker-app/**/*.test.ts", "scripts/**/*.test.ts", "client/**/*.test.ts", "client/**/*.test.tsx", "workers/**/*.test.ts", "protocol/**/*.test.mjs"],
  },
});
