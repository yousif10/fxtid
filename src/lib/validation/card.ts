import { z } from "zod";
import { ISSUE_REASONS } from "@/lib/cards/status";
import { optionalIsoDate, optionalString, optionalUuid, uuidSchema } from "./common";

export const cardIssueSchema = z.object({
  employeeId: uuidSchema,
  reason: z.enum(ISSUE_REASONS),
  templateId: optionalUuid,
  /** Optional explicit expiry; otherwise issue date + validity months. */
  expiresAt: optionalIsoDate,
  validityMonths: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1).max(120).nullable()),
  note: optionalString(300),
});
export type CardIssueInput = z.infer<typeof cardIssueSchema>;

export const CARD_STATUS_ACTIONS = ["disabled", "lost", "revoked"] as const;
export type CardStatusAction = (typeof CARD_STATUS_ACTIONS)[number];

export const cardStatusChangeSchema = z.object({
  cardId: uuidSchema,
  status: z.enum(CARD_STATUS_ACTIONS),
  reason: z.string().trim().min(3, "Please give a short reason").max(300),
});

export const cardReactivateSchema = z.object({
  cardId: uuidSchema,
  reason: z.string().trim().min(3, "Please give a short reason").max(300),
});
