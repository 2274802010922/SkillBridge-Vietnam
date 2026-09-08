import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./backend/database/migrations",
  schema: "./backend/database/schema.ts",
  dialect: "sqlite",
});
