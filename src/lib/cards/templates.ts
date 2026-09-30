import { z } from "zod";

/**
 * Card template system.
 *
 * Two levels:
 *  - LAYOUT: a physical design + orientation, implemented by a renderer in
 *    lib/cards/layouts (e.g. "fxt-portrait-v1", "fxt-landscape-v1").
 *  - TEMPLATE (database row): a layout + validated options (role label, accent,
 *    title...). "Driver / Landscape" is simply the landscape layout with the
 *    DRIVER label - no renderer changes needed for new variants.
 *
 * Issued cards snapshot their layout, orientation and options, so editing a
 * template never changes cards that were already printed.
 */

export const CARD_ORIENTATIONS = ["portrait", "landscape"] as const;
export type CardOrientation = (typeof CARD_ORIENTATIONS)[number];

export const ORIENTATION_LABELS: Record<CardOrientation, string> = {
  portrait: "Portrait",
  landscape: "Landscape",
};

/** CR80 / ID-1 physical size (ISO/IEC 7810). */
export const CR80_LONG_MM = 85.6;
export const CR80_SHORT_MM = 53.98;

export type CardDimensions = { widthMm: number; heightMm: number };

export const CARD_DIMENSIONS: Record<CardOrientation, CardDimensions> = {
  portrait: { widthMm: CR80_SHORT_MM, heightMm: CR80_LONG_MM },
  landscape: { widthMm: CR80_LONG_MM, heightMm: CR80_SHORT_MM },
};

/** @deprecated portrait-only constants kept for backward compatibility. */
export const CARD_WIDTH_MM = CR80_SHORT_MM;
/** @deprecated portrait-only constants kept for backward compatibility. */
export const CARD_HEIGHT_MM = CR80_LONG_MM;

export const cardTemplateConfigSchema = z.object({
  /** Short label printed in the header pill, e.g. "DRIVER", "MANAGEMENT". Null hides it. */
  roleLabel: z
    .string()
    .trim()
    .max(18)
    .transform((v) => v.toUpperCase())
    .nullable()
    .default(null),
  /** Which brand colour the role label and accents use. */
  accent: z.enum(["primary", "secondary"]).default("secondary"),
  /** Title printed in the header. */
  cardTitle: z.string().trim().min(2).max(28).default("STAFF IDENTITY CARD"),
  showDepartment: z.boolean().default(true),
  showQrOnFront: z.boolean().default(true),
  showSignatureLine: z.boolean().default(true),
});
export type CardTemplateConfig = z.infer<typeof cardTemplateConfigSchema>;

/**
 * Layout registry (metadata only - safe for client bundles). Renderers are
 * registered against the same keys in lib/cards/render.ts. New layout keys must
 * contain their orientation word (enforced by a database CHECK constraint).
 */
export const CARD_LAYOUTS = {
  "fxt-portrait-v1": {
    name: "FXT Portrait (CR80)",
    description: "Portrait CR80 card with FXT logo header, large photo, navy identity panel and QR verification.",
    orientation: "portrait",
  },
  "fxt-landscape-v1": {
    name: "FXT Landscape (CR80)",
    description: "Landscape CR80 card: photo left, identity centre, large QR right, navy footer band.",
    orientation: "landscape",
  },
} as const satisfies Record<string, { name: string; description: string; orientation: CardOrientation }>;

export type CardLayoutKey = keyof typeof CARD_LAYOUTS;
export const DEFAULT_LAYOUT: CardLayoutKey = "fxt-portrait-v1";
export const LAYOUT_KEYS = Object.keys(CARD_LAYOUTS) as CardLayoutKey[];

export function isCardLayout(v: string): v is CardLayoutKey {
  return v in CARD_LAYOUTS;
}

/** Unknown/legacy values fall back to the original portrait layout. */
export function resolveLayout(v: string | null | undefined): CardLayoutKey {
  return v && isCardLayout(v) ? v : DEFAULT_LAYOUT;
}

export function orientationOfLayout(layout: string | null | undefined): CardOrientation {
  return CARD_LAYOUTS[resolveLayout(layout)].orientation;
}

export function dimensionsOfLayout(layout: string | null | undefined): CardDimensions {
  return CARD_DIMENSIONS[orientationOfLayout(layout)];
}

/** "Standard Employee / Landscape" - unambiguous name shown across the admin UI. */
export function templateDisplayName(name: string | null | undefined, orientation: CardOrientation): string {
  return `${name ?? "Standard"} / ${ORIENTATION_LABELS[orientation]}`;
}

export function parseTemplateConfig(raw: unknown): CardTemplateConfig {
  const parsed = cardTemplateConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : cardTemplateConfigSchema.parse({});
}

/** Design families; each is seeded in every orientation. */
const TEMPLATE_FAMILIES: Array<{
  slug: string;
  name: string;
  description: string;
  config: Partial<CardTemplateConfig>;
}> = [
  { slug: "standard-employee", name: "Standard Employee", description: "Default card for office, operations and customer service staff.", config: { roleLabel: null } },
  { slug: "driver", name: "Driver", description: "Driver card with a red DRIVER label in the header.", config: { roleLabel: "DRIVER", accent: "secondary" } },
  { slug: "management", name: "Management", description: "Management card with a navy MANAGEMENT label.", config: { roleLabel: "MANAGEMENT", accent: "primary" } },
  { slug: "temporary-staff", name: "Temporary Staff", description: "For temporary and agency staff. Use a short validity period.", config: { roleLabel: "TEMPORARY", accent: "secondary" } },
  { slug: "contractor", name: "Contractor", description: "For contractors working on behalf of FXT.", config: { roleLabel: "CONTRACTOR", accent: "primary" } },
];

/**
 * Seeded template presets. Portrait slugs are unchanged from the first release
 * (existing databases keep their rows); landscape variants get a "-landscape" suffix.
 */
export const TEMPLATE_PRESETS: Array<{
  slug: string;
  name: string;
  description: string;
  isDefault: boolean;
  layout: CardLayoutKey;
  config: Partial<CardTemplateConfig>;
}> = TEMPLATE_FAMILIES.flatMap((f) => [
  { ...f, isDefault: f.slug === "standard-employee", layout: "fxt-portrait-v1" as const },
  { ...f, slug: `${f.slug}-landscape`, isDefault: false, layout: "fxt-landscape-v1" as const },
]);
