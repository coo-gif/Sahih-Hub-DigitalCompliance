import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // Login sessions are managed by connect-pg-simple, not this schema: never offer to rename or drop them
  tablesFilter: ["!user_sessions"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
