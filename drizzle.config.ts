import { defineConfig } from "drizzle-kit";

// Used only to *generate* SQL migrations from src/lib/db/schema.ts.
// Migrations are applied with `pnpm db:migrate` (scripts/migrate.ts), which works
// against both Postgres (DATABASE_URL) and the embedded dev database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations",
  strict: true,
});
