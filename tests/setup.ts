// Safety net: the test suite must only ever use isolated, in-memory data.
for (const name of ["DATABASE_URL", "DATABASE_MIGRATION_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (process.env[name]) throw new Error(`Refusing to run tests with ${name} set - tests must never reach a real database or bucket.`);
}
if (process.env.FXT_DATA_ENVIRONMENT === "production") throw new Error("Refusing to run tests with FXT_DATA_ENVIRONMENT=production.");
if (!process.env.PGLITE_DIR?.startsWith("memory://")) throw new Error("Tests must use the in-memory database (PGLITE_DIR=memory://).");
