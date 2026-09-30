import "server-only";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { assertDeploymentConfig, ConfigurationError, env, isProduction, isVercel } from "@/lib/env";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
/** Transaction handle type (same query API as Database). */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type GlobalDb = { __fxtDb?: Database };
const g = globalThis as unknown as GlobalDb;

function createDb(): Database {
  assertDeploymentConfig();
  if (env.DATABASE_URL) {
    const client = postgres(env.DATABASE_URL, {
      // Serverless: every instance holds its own small pool. Point DATABASE_URL at a
      // transaction-mode pooler (Supabase port 6543) so many instances share few
      // real Postgres connections.
      max: env.DB_POOL_MAX ?? (isVercel ? 3 : 10),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false, // required by transaction-mode poolers (Supabase Supavisor / PgBouncer)
      ssl: env.DATABASE_SSL === "require" ? "require" : env.DATABASE_SSL === "disable" ? false : undefined,
      connection: { application_name: "fxt-id-system" },
    });
    return drizzlePostgres(client, { schema }) as unknown as Database;
  }
  // Never fall back to the embedded database on Vercel or in a production data environment.
  if (isVercel || env.FXT_DATA_ENVIRONMENT === "production") {
    throw new ConfigurationError("DATABASE_URL is required for this deployment.");
  }
  if (isProduction && env.ALLOW_PGLITE_IN_PRODUCTION !== "true") {
    throw new ConfigurationError("DATABASE_URL is required in production.");
  }
  // Embedded Postgres (WASM) for local development & automated testing only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  if (!env.PGLITE_DIR.startsWith("memory://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("node:fs") as typeof import("node:fs")).mkdirSync(env.PGLITE_DIR, { recursive: true });
  }
  const client = new PGlite(env.PGLITE_DIR);
  return drizzlePglite(client, { schema }) as unknown as Database;
}

/** Lazily-initialised shared database handle (one pool per server instance; survives dev hot reloads). */
export function getDb(): Database {
  if (!g.__fxtDb) g.__fxtDb = createDb();
  return g.__fxtDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
