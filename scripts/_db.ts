// Shared helper for CLI scripts (run with: tsx --conditions=react-server).
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" }); // real environment variables take precedence

/** True when the script targets the production data set. */
export function targetsProduction(): boolean {
  return process.env.FXT_DATA_ENVIRONMENT === "production";
}

/**
 * Scripts that change a production database must be confirmed explicitly:
 *   --confirm-production   (or CONFIRM_PRODUCTION=yes)
 */
export function requireProductionConfirmation(action: string): void {
  if (!targetsProduction()) return;
  if (process.argv.includes("--confirm-production") || process.env.CONFIRM_PRODUCTION === "yes") return;
  console.error(`Refusing to ${action} against PRODUCTION (FXT_DATA_ENVIRONMENT=production) without --confirm-production.`);
  process.exit(2);
}

/** Host/database only - never print credentials. */
export function describeTarget(url: string | undefined): string {
  if (!url) return `embedded PGlite (${process.env.PGLITE_DIR ?? "./.data/pglite"})`;
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/**
 * Opens a database for CLI use. Migrations and admin tasks prefer
 * DATABASE_MIGRATION_URL (Supabase: direct or session-pooler connection, port
 * 5432) and fall back to DATABASE_URL.
 */
export async function openDb(opts: { preferMigrationUrl?: boolean } = {}) {
  const schema = await import("../src/lib/db/schema");
  const url = (opts.preferMigrationUrl && process.env.DATABASE_MIGRATION_URL) || process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const ssl = process.env.DATABASE_SSL;
    const client = postgres(url, {
      max: 1,
      prepare: false,
      ssl: ssl === "require" ? "require" : ssl === "disable" ? false : undefined,
      onnotice: () => {},
    });
    const db = drizzle(client, { schema });
    return { db, schema, kind: "postgres" as const, target: describeTarget(url), close: () => client.end(), client };
  }
  if (targetsProduction()) throw new Error("FXT_DATA_ENVIRONMENT=production requires DATABASE_URL / DATABASE_MIGRATION_URL.");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE_IN_PRODUCTION !== "true") {
    throw new Error("DATABASE_URL is required in production.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
  (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  return { db, schema, kind: "pglite" as const, target: describeTarget(undefined), close: () => client.close(), client };
}
