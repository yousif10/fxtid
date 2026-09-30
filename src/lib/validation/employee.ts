import { z } from "zod";
import { optionalIsoDate, optionalString, optionalUuid } from "./common";

export const EMPLOYMENT_STATUSES = ["active", "on_leave", "suspended", "left"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  suspended: "Suspended",
  left: "Left company",
};

export const employeeNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, "Use 2-32 capital letters, numbers or hyphens (e.g. FXT-00042)");

const nameRegex = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

const optionalEmail = optionalString(160).refine((v) => v === null || z.string().email().safeParse(v).success, {
  message: "Enter a valid email address",
});
const optionalPhone = optionalString(40).refine((v) => v === null || /^[+0-9 ()-]{6,40}$/.test(v), {
  message: "Enter a valid phone number",
});

export const employeeSchema = z
  .object({
    employeeNumber: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : null))
      .pipe(employeeNumberSchema.nullable()),
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the employee's full name")
      .max(120)
      .regex(nameRegex, "Name contains unsupported characters")
      .transform((v) => v.replace(/\s+/g, " ")),
    displayName: optionalString(60).refine((v) => v === null || nameRegex.test(v), {
      message: "Name contains unsupported characters",
    }),
    email: optionalEmail,
    phone: optionalPhone,
    departmentId: optionalUuid,
    positionId: optionalUuid,
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).default("active"),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
    notes: optionalString(2000),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type EmployeeInput = z.infer<typeof employeeSchema>;

/** CSV import row (department/position given by name instead of ID). */
export const employeeImportRowSchema = z.object({
  employee_number: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null))
    .pipe(employeeNumberSchema.nullable()),
  full_name: z
    .string()
    .trim()
    .min(2, "full_name is required")
    .max(120)
    .regex(nameRegex, "Unsupported characters in full_name"),
  display_name: optionalString(60),
  department: optionalString(80),
  position: optionalString(80),
  email: optionalEmail,
  phone: optionalPhone,
  start_date: optionalIsoDate,
  employment_status: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase().replace(/\s+/g, "_") : "active"))
    .pipe(z.enum(EMPLOYMENT_STATUSES, { message: "employment_status must be active, on_leave, suspended or left" })),
});
export type EmployeeImportRow = z.infer<typeof employeeImportRowSchema>;
