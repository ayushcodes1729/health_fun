import { defineConfig } from "drizzle-kit";

/**
 * Migrations should use Neon's DIRECT (unpooled) endpoint when one is set.
 * The pooled endpoint shares server backends between clients in transaction
 * mode, so session-level state from a migration or pg_dump — search_path in
 * particular — leaks onto backends the app later receives. The direct
 * endpoint gives the migrator its own session. The app keeps using the
 * pooled URL, which is right for serverless.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (and ideally DATABASE_URL_UNPOOLED for Neon)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
