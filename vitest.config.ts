import { defineConfig } from "vitest/config";
import path from "path";

// Set a dummy DATABASE_URL for tests to prevent getDb() from throwing.
// Actual DB operations should be mocked in tests.
process.env.DATABASE_URL = "mysql://root:password@localhost:3306/db";

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
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    setupFiles: ["server/test-setup.ts"],
  },
});
