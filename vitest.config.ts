import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  plugins: [react()],
  resolve: {
    alias: [
      // Server-side carve-outs must come before the client catch-all.
      // Using regex to avoid prefix-matching scoped packages like @trpc, @radix.
      {
        find: /^@\/lib\/attestation(\/.*)?$/,
        replacement: path.resolve(templateRoot, "src", "lib", "attestation"),
      },
      {
        find: /^@\/db(\/.*)?$/,
        replacement: path.resolve(templateRoot, "src", "db"),
      },
      {
        find: "@/../fixtures",
        replacement: path.resolve(templateRoot, "fixtures"),
      },
      // Client catch-all: @/anything-else → client/src
      {
        find: /^@\/(.*)/,
        replacement: path.resolve(templateRoot, "client", "src", "$1"),
      },
      { find: "@shared", replacement: path.resolve(templateRoot, "shared") },
      { find: "@assets", replacement: path.resolve(templateRoot, "attached_assets") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
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
