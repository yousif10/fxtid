/**
 * Applies SQL migrations from db/migrations. Run explicitly as a setup /
 * deployment step - never on each request or build.
 *
 *   pnpm db:migrate                         # local / preview
 *   pnpm db:migrate --confirm-production    # production (FXT_DATA_ENVIRONMENT=production)
 */
import { openDb, requireProductionConfirmation } from "./_db";

async function main() {
  requireProductionConfirmation("apply migrations");
  const handle = await openDb({ preferMigrationUrl: true });
  console.log(`Applying migrations to ${handle.target} …`);
  const migrationsFolder = "./db/migrations";
  if (handle.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(handle.db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db, { migrationsFolder });
  }
  console.log(`Migrations applied (${handle.kind}).`);
  await handle.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
