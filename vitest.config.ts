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
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    testTimeout: 20000,
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "worker-app/**/*.test.ts", "scripts/**/*.test.ts", "client/**/*.test.ts", "client/**/*.test.tsx"],
  },
});
