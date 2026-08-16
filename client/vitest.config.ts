import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname, "./");

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@shared": path.resolve(root, "../shared"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    globals: true,
  },
});
