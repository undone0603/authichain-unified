import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: [
      // More specific first: tsconfig's "@/*" resolves against "./src/*" before
      // falling back to "./client/src/*" (see tsconfig.json paths). Vite's alias
      // list has no such fallback, so "@/db" is special-cased here to point at
      // the Drizzle module under src/db that guardrail.ts (and friends) import.
      { find: "@/db", replacement: path.resolve(templateRoot, "src", "db") },
      { find: "@shared", replacement: path.resolve(templateRoot, "shared") },
      { find: "@assets", replacement: path.resolve(templateRoot, "attached_assets") },
      { find: "@", replacement: path.resolve(templateRoot, "client", "src") },
    ],
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "worker-app/**/*.test.ts", "scripts/**/*.test.ts", "client/**/*.test.ts", "client/**/*.test.tsx"],
  },
});
