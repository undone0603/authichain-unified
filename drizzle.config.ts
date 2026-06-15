import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed for `drizzle-kit push`/`migrate`; `generate` works offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
