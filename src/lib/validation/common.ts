import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/** Empty strings from HTML forms become null. */
export const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const optionalUuid = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, { message: "Invalid selection" });

export const uuidSchema = z.string().uuid("Invalid identifier");

export const isoDate = z.string().trim().refine(isIsoDate, { message: "Enter a valid date" });

export const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), { message: "Enter a valid date" });

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
  .optional()
  .nullable()
  .transform((v) => v === true || v === "on" || v === "true");

export function formDataToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}
