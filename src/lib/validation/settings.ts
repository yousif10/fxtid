import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #02214F")
  .transform((v) => v.toUpperCase());

export const companySettingsSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(60),
  shortName: z.string().trim().min(1).max(12),
  tagline: optionalText(120),
  website: optionalText(120).refine((v) => v === null || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v.replace(/^https?:\/\//, "")), {
    message: "Enter a valid website, e.g. www.example.co.uk",
  }),
  supportEmail: optionalText(160).refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  }),
  phone: optionalText(40).refine((v) => v === null || /^[+0-9 ()-]{6,40}$/.test(v), {
    message: "Enter a valid phone number",
  }),
  address: optionalText(240),
  returnText: z.string().trim().min(5).max(200),
});

export const cardSettingsSchema = z.object({
  defaultValidityMonths: z.coerce.number().int().min(1).max(120),
  expiringSoonDays: z.coerce.number().int().min(7).max(180),
  employeeNumberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, "Letters and numbers only (max 8)"),
  employeeNumberDigits: z.coerce.number().int().min(3).max(8),
  cardNumberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, "Letters and numbers only (max 8)"),
  requirePhotoForIssue: z.coerce.boolean(),
});

export const brandingSettingsSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
});

export type CompanySettings = z.infer<typeof companySettingsSchema>;
export type CardSettings = z.infer<typeof cardSettingsSchema>;
export type BrandingSettings = z.infer<typeof brandingSettingsSchema>;

export type AppSettings = {
  company: CompanySettings;
  cards: CardSettings;
  branding: BrandingSettings;
};

/** Defaults derived from the FXT brand assets in the project (logo + delivery note). */
export const DEFAULT_SETTINGS: AppSettings = {
  company: {
    legalName: "Fast Express Transport Limited",
    displayName: "Fast Express Transport",
    shortName: "FXT",
    tagline: "Reliable • Professional • Responsive • Available 24/7",
    website: null,
    supportEmail: null,
    phone: null,
    address: null,
    returnText: "If found, please return this card to Fast Express Transport Limited.",
  },
  cards: {
    defaultValidityMonths: 24,
    expiringSoonDays: 30,
    employeeNumberPrefix: "FXT",
    employeeNumberDigits: 5,
    cardNumberPrefix: "CARD",
    requirePhotoForIssue: true,
  },
  branding: {
    primaryColor: "#02214F",
    secondaryColor: "#D11E25",
    accentColor: "#0B3A7E",
  },
};

export const settingsSchemas = {
  company: companySettingsSchema,
  cards: cardSettingsSchema,
  branding: brandingSettingsSchema,
} as const;
export type SettingsKey = keyof AppSettings;
