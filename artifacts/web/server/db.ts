import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;

// Enable SSL for Supabase, Render, or any URL with sslmode=require
const needsSSL =
  dbUrl.includes("supabase.co") ||
  dbUrl.includes("sslmode=require") ||
  process.env.DATABASE_SSL === "true";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  max: 10, // Limit pool size for Supabase compatibility
});

export const db = drizzle(pool, { schema });
