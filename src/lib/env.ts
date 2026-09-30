import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. Nothing here is exposed to the browser (there are
 * deliberately no NEXT_PUBLIC_* variables). Parsing is lenient so `next build`
 * works without secrets; runtime requirements are enforced lazily by
 * assertDeploymentConfig() when the database or storage is first used.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public base URL used in QR codes, e.g. https://id.fxt-ltd.co.uk (no trailing slash). */
  APP_URL: z
    .string()
    .url()
    .optional()
    .transform((v) => v?.replace(/\/+$/, "")),
  /** Runtime Postgres connection string (Supabase: transaction pooler, port 6543). */
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.enum(["require", "prefer", "disable"]).optional(),
  /** Max connections per server instance. Keep small on serverless (default 3 on Vercel, 10 elsewhere). */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  PGLITE_DIR: z.string().default("./.data/pglite"),
  ALLOW_PGLITE_IN_PRODUCTION: z.enum(["true", "false"]).optional(),

  /** "local" (development / self-hosted volume) or "supabase" (private Supabase Storage bucket). */
  STORAGE_DRIVER: z.enum(["local", "supabase"]).optional(),
  /** Directory for employee photographs when STORAGE_DRIVER=local. */
  STORAGE_DIR: z.string().default("./storage"),
  /** Supabase project URL, e.g. https://abcd.supabase.co (server-only - NOT a NEXT_PUBLIC variable). */
  SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .transform((v) => v?.replace(/\/+$/, "")),
  /** Supabase secret key (sb_secret_…) or legacy service_role key. Server-only. */
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]{2,62}$/)
    .default("employee-photos"),

  /**
   * Which data set this deployment is allowed to touch: "production", "preview"
   * or "development". Set per Vercel environment together with the database and
   * storage credentials - see assertDeploymentConfig().
   */
  FXT_DATA_ENVIRONMENT: z.enum(["production", "preview", "development"]).optional(),

  /** Session lifetime in hours. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  /** Trust X-Forwarded-For for client IPs (automatic on Vercel, whose edge sets it). */
  TRUST_PROXY: z.enum(["true", "false"]).optional(),

  // Set automatically by Vercel.
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
});

// Empty strings (common in CI and hosting dashboards) are treated as "not set".
const raw = envSchema.parse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== "")));

export const isProduction = raw.NODE_ENV === "production";
export const isVercel = raw.VERCEL === "1" || !!raw.VERCEL_ENV;

/** The production hostname; preview deployments must never mint cards pointing at it. */
export const PRODUCTION_HOST = "id.fxt-ltd.co.uk";

function resolveAppUrl(): string {
  if (raw.APP_URL) return raw.APP_URL;
  // Preview deployments without an explicit APP_URL use their own unique URL.
  if (raw.VERCEL_ENV === "preview" && raw.VERCEL_URL) return `https://${raw.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const env = {
  ...raw,
  APP_URL: resolveAppUrl(),
  TRUST_PROXY: raw.TRUST_PROXY ?? (isVercel ? "true" : "false"),
  STORAGE_DRIVER: raw.STORAGE_DRIVER ?? (isProduction && isVercel ? "supabase" : "local"),
} as const;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
    this.name = "ConfigurationError";
  }
}

/**
 * Deployment safety interlock, evaluated once at runtime (not at build time).
 *
 * - Vercel production must declare FXT_DATA_ENVIRONMENT=production.
 * - Vercel previews must NOT use FXT_DATA_ENVIRONMENT=production, and must not
 *   issue cards whose QR codes point at the production domain.
 * - Serverless deployments must use Postgres + Supabase Storage (no PGlite, no local disk).
 *
 * Because Vercel scopes environment variables per environment, accidentally
 * copying production database credentials to Preview also copies
 * FXT_DATA_ENVIRONMENT=production - which this check then refuses.
 */
export function checkDeploymentConfig(e: typeof env = env): string[] {
  const problems: string[] = [];
  const vercel = e.VERCEL === "1" || !!e.VERCEL_ENV;
  if (vercel) {
    if (!e.DATABASE_URL) problems.push("DATABASE_URL is required on Vercel (embedded PGlite is never used there).");
    if (e.STORAGE_DRIVER !== "supabase") problems.push("STORAGE_DRIVER must be 'supabase' on Vercel (the filesystem is not persistent).");
    if (!e.FXT_DATA_ENVIRONMENT) problems.push("FXT_DATA_ENVIRONMENT must be set on Vercel.");
    if (e.VERCEL_ENV === "production" && e.FXT_DATA_ENVIRONMENT !== "production") {
      problems.push("The Vercel production deployment must set FXT_DATA_ENVIRONMENT=production.");
    }
    if (e.VERCEL_ENV !== "production" && e.FXT_DATA_ENVIRONMENT === "production") {
      problems.push(`A ${e.VERCEL_ENV ?? "non-production"} deployment is configured with production data (FXT_DATA_ENVIRONMENT=production). Use separate preview credentials.`);
    }
    if (e.VERCEL_ENV !== "production" && new URL(e.APP_URL).host === PRODUCTION_HOST) {
      problems.push(`APP_URL points at ${PRODUCTION_HOST} on a ${e.VERCEL_ENV ?? "non-production"} deployment; QR codes would reference production.`);
    }
  }
  if (e.FXT_DATA_ENVIRONMENT === "production" && e.NODE_ENV === "production") {
    if (!e.APP_URL.startsWith("https://")) problems.push("APP_URL must use https:// in production.");
  }
  if (e.STORAGE_DRIVER === "supabase" && (!e.SUPABASE_URL || !e.SUPABASE_SECRET_KEY)) {
    problems.push("STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  return problems;
}

let checked = false;
export function assertDeploymentConfig(): void {
  if (checked) return;
  const problems = checkDeploymentConfig();
  if (problems.length) throw new ConfigurationError(problems.join(" "));
  checked = true;
}
