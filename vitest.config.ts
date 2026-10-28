import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const templateRoot = path.resolve(import.meta.dirname);

const NODE_TEST_IMPORT = /(?:from\s+|require\(\s*)[`"']node:test[`"']/;
const TEST_FILE = /\.?(?:test|spec)\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  ".turbo",
  ".next",
]);

// Setting `test.exclude` replaces Vitest's defaults, so they are spread back
// in below. node:test files stay with their workspace runners.
function nodeTestFiles(root: string): string[] {
  const found: string[] = [];
  const scan = [
    "api",
    "apps",
    "client",
    "ops",
    "packages",
    "protocol",
    "scripts",
    "server",
    "shared",
    "src",
    "worker",
    "worker-app",
    "workers",
  ];

  for (const sub of scan) {
    const dir = path.join(root, sub);
    try {
      walk(dir);
    } catch {
      // ignore
    }
  }

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) {
          walk(path.join(dir, ent.name));
        }
      } else if (ent.isFile() && TEST_FILE.test(ent.name)) {
        const file = path.join(dir, ent.name);
        try {
          const contents = readFileSync(file, "utf8");
          if (NODE_TEST_IMPORT.test(contents)) {
            found.push(path.relative(root, file));
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return found;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@authichain/contracts",
        replacement: path.resolve(
          templateRoot,
          "packages",
          "contracts",
          "src",
          "index.ts"
        ),
      },
      {
        find: "@authichain/evidence",
        replacement: path.resolve(
          templateRoot,
          "packages",
          "evidence",
          "src",
          "index.ts"
        ),
      },
      {
        find: "@authichain/policy",
        replacement: path.resolve(
          templateRoot,
          "packages",
          "policy",
          "src",
          "index.ts"
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [
      "./scripts/vitest-isolate-delivery-env.ts",
      "./apps/verifier-web/src/setupTests.ts",
    ],
    exclude: [
      ...configDefaults.exclude,
      "apps/agent-browser/**",
      ...nodeTestFiles(templateRoot),
    ],
    include: [
      "api/**/*.test.ts",
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "worker-app/**/*.test.ts",
      "worker/**/*.test.ts",
      "scripts/**/*.test.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
      "workers/**/*.test.ts",
      "protocol/**/*.test.mjs",
      "protocol/**/*.test.ts",
      "ops/**/*.test.ts",
      "scripts/**/*.test.js",
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
    ],
  },
});
