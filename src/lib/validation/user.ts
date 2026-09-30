import { z } from "zod";
import { ADMIN_ROLES } from "@/lib/permissions";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200)
  .refine((v) => /[a-z]/i.test(v) && /[0-9]/.test(v), "Include at least one letter and one number");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address").max(160),
  password: z.string().min(1, "Enter your password").max(200),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  fullName: z.string().trim().min(2, "Enter a name").max(120),
  role: z.enum(ADMIN_ROLES),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Enter a name").max(120),
  role: z.enum(ADMIN_ROLES),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
