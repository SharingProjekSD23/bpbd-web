import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/postgresql",
  schema: "./db/schema.ts",
  dialect: "postgresql",
});
