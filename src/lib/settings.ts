import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { DEFAULT_SETTINGS, settingsSchemas, type AppSettings, type SettingsKey } from "@/lib/validation/settings";

/** Reads all settings, merging stored values over defaults. Invalid stored values fall back safely. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.select().from(systemSettings);
  const result: AppSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as SettingsKey;
    if (!(key in settingsSchemas)) continue;
    const merged = { ...DEFAULT_SETTINGS[key], ...(row.value as object) };
    const parsed = settingsSchemas[key].safeParse(merged);
    if (parsed.success) (result as Record<SettingsKey, unknown>)[key] = parsed.data;
  }
  return result;
});
