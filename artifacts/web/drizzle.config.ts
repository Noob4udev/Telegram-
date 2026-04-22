import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL;

const needsSSL =
  dbUrl?.includes("supabase.co") ||
  dbUrl?.includes("sslmode=require") ||
  process.env.DATABASE_SSL === "true";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl || "",
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  },
});
