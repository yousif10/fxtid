import "server-only";
import { assertDeploymentConfig, ConfigurationError, env } from "@/lib/env";
import { createLocalStorage } from "./local";
import { createSupabaseStorage } from "./supabase";
import type { ObjectStorage } from "./types";

export { isValidStorageKey, StorageError, type ObjectStorage } from "./types";

const g = globalThis as unknown as { __fxtStorage?: ObjectStorage };

/** Storage adapter selected by STORAGE_DRIVER ("local" in development, "supabase" on Vercel). */
export function getStorage(): ObjectStorage {
  if (g.__fxtStorage) return g.__fxtStorage;
  assertDeploymentConfig();
  if (env.STORAGE_DRIVER === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new ConfigurationError("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
    g.__fxtStorage = createSupabaseStorage({ url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY, bucket: env.SUPABASE_STORAGE_BUCKET });
  } else {
    g.__fxtStorage = createLocalStorage(env.STORAGE_DIR);
  }
  return g.__fxtStorage;
}

/** Test hook: replace the storage adapter. */
export function setStorageForTesting(storage: ObjectStorage | undefined): void {
  g.__fxtStorage = storage;
}
