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
      //
      // Each replacement must end in $1, because a regex `find` is applied as
      // id.replace(find, replacement) and these patterns are anchored with $ —
      // so the match spans the whole specifier, subpath included. Without the
      // backreference the subpath is swallowed: "@/db/schema" becomes "src/db"
      // and "@/lib/attestation/v01" becomes a directory with no index file.
      // A non-participating group substitutes as empty, so bare "@/db" still
      // resolves to src/db.
      {
        find: /^@\/lib\/attestation(\/.*)?$/,
        replacement:
          path.resolve(templateRoot, "src", "lib", "attestation") + "$1",
      },
      {
        find: /^@\/db(\/.*)?$/,
        replacement: path.resolve(templateRoot, "src", "db") + "$1",
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
      {
        find: "@assets",
        replacement: path.resolve(templateRoot, "attached_assets"),
      },
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
