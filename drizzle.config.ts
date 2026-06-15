import { defineConfig } from "drizzle-kit";

export default defineConfig({
<<<<<<< HEAD
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
=======
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
>>>>>>> origin/add-agentz-editable
  dialect: "postgresql",
  dbCredentials: {
    // Only needed for `drizzle-kit push`/`migrate`; `generate` works offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
