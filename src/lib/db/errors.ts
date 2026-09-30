/** Extracts a Postgres SQLSTATE from errors thrown by postgres-js, PGlite or Drizzle wrappers. */
export function pgErrorCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const c = (e as { constraint_name?: unknown; constraint?: unknown }).constraint_name ?? (e as { constraint?: unknown }).constraint;
    if (typeof c === "string") return c;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isUniqueViolation = (err: unknown) => pgErrorCode(err) === "23505";
export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === "23503";

/** Normalises raw `execute()` results across drivers to a row array. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
