import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/**
 * One connection pool per server process. Works against local Postgres and
 * Neon alike over the standard wire protocol; on Vercel use Neon's POOLED
 * connection string (the `-pooler` host) so serverless instances don't
 * exhaust connections.
 */
const globalForDb = globalThis as unknown as { __hfSql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.__hfSql ??
  postgres(required("DATABASE_URL"), {
    max: 5,
    // Neon requires TLS; local Postgres usually has none. Let the URL decide.
    ssl: process.env.DATABASE_URL?.includes("sslmode=require") ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__hfSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
