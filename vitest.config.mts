import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    // Allows importing server modules guarded by "server-only".
    conditions: ["react-server"],
  },
  ssr: { resolve: { conditions: ["react-server"] } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Isolated test data only: an in-memory Postgres (PGlite) and a throwaway local
    // storage directory. Any database/storage credentials present in the shell are
    // blanked, and tests/setup.ts aborts if one slips through.
    env: {
      PGLITE_DIR: "memory://",
      STORAGE_DIR: "./.data/test-storage",
      STORAGE_DRIVER: "local",
      APP_URL: "https://id.example.co.uk",
      DATABASE_URL: "",
      DATABASE_MIGRATION_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: "",
      FXT_DATA_ENVIRONMENT: "",
      VERCEL: "",
      VERCEL_ENV: "",
    },
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
